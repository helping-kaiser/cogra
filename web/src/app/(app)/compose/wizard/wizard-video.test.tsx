// The video path through the wizard, as a reader drives it.
//
// Its own file because of the mock below: jsdom decodes no video, so the probe
// and the frame capture — the two places this flow touches a real decoder —
// are stubbed. Everything else is the real wizard, the real reducer and the
// real gates, so what is proven here is the WIRING: that a picked video reaches
// the cover screen, that the offers appear with the first one taken, and that
// the composition rule is enforced where an author can see it.

import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
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
}

const aVideo = () => new File([mp4Bytes() as BlobPart], "clip.mp4", { type: "video/mp4" });
const aPicture = () =>
  new File([new Uint8Array([1, 2, 3]) as BlobPart], "shot.jpg", { type: "image/jpeg" });

function render() {
  return renderWithProviders(
    <ComposeWizard store={fakeIdentityStore({ keyOnDevice: true })} drafts={fakeDrafts()} />,
    { tokens: signedInStore(), signer: fakeWriteSigner() },
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

    expect(await screen.findByTestId("wizard-body-error")).toHaveTextContent(
      "A post carries pictures or one video, not both.",
    );
    // And nothing was taken away from the author in the process: the tray is
    // still there with the picture in it.
    expect(screen.getByTestId("wizard-show-all")).toBeInTheDocument();
  });

  it("refuses a container the server would refuse, before it is uploaded", async () => {
    render();
    const notMp4 = new File([new Uint8Array(32) as BlobPart], "clip.mkv", { type: "video/x-matroska" });
    await pickFiles([notMp4]);

    expect(await screen.findByTestId("wizard-body-error")).toHaveTextContent(
      "Only MP4 video is accepted.",
    );
  });
});
