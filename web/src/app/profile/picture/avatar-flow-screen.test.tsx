// The picture's own flow from the head's change badge (Profile.md:47):
// AvatarCrop → AvatarSeal → the signed change, staged picture-only.

import { createHash } from "node:crypto";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { holdPicture, heldPicture, releaseHeldPicture } from "@/lib/profile/held-picture";
import { resetProfileChangeForTests } from "@/lib/profile/profile-change";
import { readSignedProfile } from "@/lib/profile/signed-profile";
import { createTokenStore } from "@/lib/session/token-store";
import { TOO_BIG_PICTURE } from "@/lib/compose/pick";
import { CarriedSnackbar } from "@/lib/ui/carried-snackbar";
import { PICTURE_MAX_BYTES } from "@/lib/ui2/media/caps";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { fakeIdentityStore } from "@/test/identity";
import { AvatarFlowScreen } from "./avatar-flow-screen";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

const server = startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
}

function myProfileHandler() {
  return gqlLink.query("MyProfile", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: "Ada", status: "NORMAL" },
          bio: { __typename: "ModeratedText", value: "Old bio", status: "NORMAL" },
          websiteUrl: { __typename: "ModeratedText", value: "ada.example", status: "NORMAL" },
          avatar: null,
        },
      },
    }),
  );
}

/** Captures what the change actually carried, which is the whole question. */
function capturingPrepare(seen: { input?: Record<string, unknown>; calls: number }) {
  return gqlLink.mutation("PrepareProfileUpdate", ({ variables }) => {
    seen.calls += 1;
    seen.input = (variables as { input: Record<string, unknown> }).input;
    return HttpResponse.json({
      data: {
        prepareProfileUpdate: {
          __typename: "PreparePayload",
          writes: [
            {
              __typename: "PreparedWrite",
              id: "w1",
              family: "REGISTRATION",
              canonicalProposal: "cHJvcG9zYWw=",
              gcAfterEpochs: 8,
            },
          ],
          userErrors: [],
        },
      },
    });
  });
}

/** The digest of what `installEncoder`'s canvas encodes to, by Node's own crypto. */
const ENCODED_DIGEST = createHash("sha256").update(new Uint8Array(8)).digest("hex");

function uploadHandler(id: string) {
  return gqlLink.mutation("UploadMedia", () =>
    HttpResponse.json({
      data: {
        uploadMedia: {
          __typename: "UploadMediaPayload",
          media: {
            __typename: "MediaAttachment",
            id,
            url: `https://media.test/${id}.webp`,
            altText: null,
            status: "NORMAL",
            mimeType: "image/webp",
            options: { __typename: "MediaOptions", aspectRatio: "1:1", durationMs: null },
            coverMedia: null,
            coverTaken: false,
            state: "READY",
            failureReason: null,
            digest: ENCODED_DIGEST,
            uploadDigest: ENCODED_DIGEST,
          },
          userErrors: [],
        },
      },
    }),
  );
}

/** jsdom has no canvas and no WebP encoder, so the encode is stubbed whole. */
function installEncoder(bytes = 8) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1200, height: 1200, close: () => {} })),
  );
  class Canvas {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return { drawImage: () => {} };
    }
    async convertToBlob({ type }: { type: string }) {
      return new Blob([new Uint8Array(new ArrayBuffer(bytes)) as BlobPart], { type });
    }
  }
  vi.stubGlobal("OffscreenCanvas", Canvas);
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:preview", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
}

function face() {
  return new File([new Uint8Array([1, 2, 3]) as BlobPart], "face.jpg", { type: "image/jpeg" });
}

function draw(signer = fakeWriteSigner()) {
  renderWithProviders(
    <>
      <AvatarFlowScreen store={fakeIdentityStore({ keyOnDevice: true })} />
      <CarriedSnackbar />
    </>,
    { store: signedInStore(), writeSigner: signer },
  );
  return signer;
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
  replace.mockClear();
  releaseHeldPicture();
  resetProfileChangeForTests();
});

// AvatarCrop.md:17-23 — the crop, opened from the badge.
describe("the crop, opened from the head's change badge", () => {
  it("opens on the picked picture, titled Your picture, with Next pinned", async () => {
    installEncoder();
    holdPicture(face());
    server.use(myProfileHandler());
    draw();
    expect(await screen.findByRole("heading", { name: "Your picture" })).toBeInTheDocument();
    expect(screen.getByTestId("avatar-crop-next")).toHaveTextContent("Next");
  });

  it("goes back to its opener, the profile, from the arrow, nothing signed (seam 335, 325-2)", async () => {
    installEncoder();
    holdPicture(face());
    const seen = { calls: 0 };
    server.use(myProfileHandler(), capturingPrepare(seen));
    draw();
    fireEvent.click(await screen.findByLabelText("Back a step"));
    expect(push).toHaveBeenCalledWith("/profile");
    expect(seen.calls).toBe(0);
    // The pick is nobody's once the flow is left.
    expect(heldPicture()).toBeNull();
  });

  it("leaves the flow from the X, nothing signed", async () => {
    installEncoder();
    holdPicture(face());
    const seen = { calls: 0 };
    server.use(myProfileHandler(), capturingPrepare(seen));
    draw();
    fireEvent.click(await screen.findByLabelText("Leave"));
    expect(push).toHaveBeenCalledWith("/profile");
    expect(seen.calls).toBe(0);
  });

  it("returns to the profile when nothing was picked (a reload, a typed address)", async () => {
    server.use(myProfileHandler());
    draw();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
    expect(screen.queryByTestId("avatar-crop")).toBeNull();
  });

  it("opens the picture's own seal from Next, never the edit (AvatarCrop.md:17)", async () => {
    installEncoder();
    holdPicture(face());
    const seen = { calls: 0 } as { input?: Record<string, unknown>; calls: number };
    server.use(myProfileHandler(), uploadHandler("m-9"), capturingPrepare(seen));
    const signer = draw();
    fireEvent.click(await screen.findByTestId("avatar-crop-next"));
    expect(await screen.findByTestId("avatar-seal")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-edit")).toBeNull();
    // Next stages the change and signs nothing; the seal's commit does.
    expect(signer.signStaged).not.toHaveBeenCalled();
  });
});

describe("the avatar-only prepare", () => {
  it("stages the picture alone: no name, bio or website on the wire", async () => {
    installEncoder();
    holdPicture(face());
    const seen = { calls: 0 } as { input?: Record<string, unknown>; calls: number };
    server.use(myProfileHandler(), uploadHandler("m-9"), capturingPrepare(seen));
    draw();
    fireEvent.click(await screen.findByTestId("avatar-crop-next"));
    await screen.findByTestId("avatar-seal");
    expect(seen.input).toEqual({ avatarMediaId: "m-9" });
  });

  it("keeps today's line on the crop for a picture over the cap, uploading nothing (held at design)", async () => {
    installEncoder(PICTURE_MAX_BYTES + 1);
    holdPicture(face());
    const upload = vi.fn();
    server.use(
      myProfileHandler(),
      gqlLink.mutation("UploadMedia", () => {
        upload();
        return HttpResponse.json({ data: { uploadMedia: null } });
      }),
    );
    draw();
    fireEvent.click(await screen.findByTestId("avatar-crop-next"));
    expect(await screen.findByTestId("avatar-crop-refused")).toHaveTextContent(TOO_BIG_PICTURE);
    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByTestId("avatar-seal")).toBeNull();
  });
});

// AvatarSeal.md — the seal in the flow.
describe("the picture's seal in its flow", () => {
  async function toSeal(signer = fakeWriteSigner()) {
    installEncoder();
    holdPicture(face());
    const seen = { calls: 0 } as { input?: Record<string, unknown>; calls: number };
    server.use(myProfileHandler(), uploadHandler("m-9"), capturingPrepare(seen));
    draw(signer);
    fireEvent.click(await screen.findByTestId("avatar-crop-next"));
    await screen.findByTestId("avatar-seal");
    return signer;
  }

  it("signs the change, lands on the profile and confirms in the snackbar", async () => {
    const signer = await toSeal();
    fireEvent.click(screen.getByTestId("avatar-seal-sign"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/profile"));
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("carried-snackbar")).toHaveTextContent(
      "Signed — your profile shows it now, still settling.",
    );
    // AvatarSeal.md:37 "the profile shows the change": the head wears the new
    // picture — and no other field — until its next read answers.
    expect(readSignedProfile("u1")).toEqual({ avatar: { id: "m-9", url: "https://media.test/m-9.webp" } });
  });

  it("brings the crop back, one stage behind, from Back and the arrow (AvatarSeal.md:41-43)", async () => {
    await toSeal();
    fireEvent.click(screen.getByTestId("avatar-seal-back"));
    expect(await screen.findByTestId("avatar-crop")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("avatar-crop-next"));
    await screen.findByTestId("avatar-seal");
    fireEvent.click(screen.getByLabelText("Back a step"));
    expect(await screen.findByTestId("avatar-crop")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves the flow from the X, nothing signed (AvatarSeal.md:45)", async () => {
    const signer = await toSeal();
    fireEvent.click(screen.getByLabelText("Leave"));
    expect(push).toHaveBeenCalledWith("/profile");
    expect(signer.signStaged).not.toHaveBeenCalled();
  });

  it("returns to the crop from the bug notice's Not now, signing nothing (AvatarSeal.md:35)", async () => {
    const refused = fakeWriteSigner();
    refused.signStaged = vi.fn(async (staged: { id: string }) => ({
      kind: "refused" as const,
      id: staged.id,
      errors: [{ message: "no", code: "BAD_INPUT" as const, field: ["avatar"] }],
    }));
    await toSeal(refused);
    fireEvent.click(screen.getByTestId("avatar-seal-sign"));
    expect(await screen.findByTestId("avatar-seal-bug")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("avatar-seal-not-now"));
    expect(await screen.findByTestId("avatar-crop")).toBeInTheDocument();
  });
});
