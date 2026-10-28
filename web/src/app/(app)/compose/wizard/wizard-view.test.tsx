// The wizard as a reader drives it. `wizard.test.ts` proves the rules; this
// proves the screens obey them — and it leans on the branches that are easy to
// get wrong in a five-screen flow: the XOR, an upload that fails and is retried,
// a batch that expires, a browser with no key, and the draft that outlives all
// of it.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { echoedMedia } from "@/test/media-echo";
import { fakeWriteSigner } from "@/test/registration";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { DEFAULT_P_DIRECTED, emptyWizard, type WizardState } from "@/lib/compose/wizard";
import { createComposeDraftStore, type ComposeDraftStore } from "@/lib/compose/draft-store";
import { createSealedDraftStore, type SealedDraftStore } from "@/lib/compose/sealed-draft";
import { KNOB_TRAVEL_INSET_PX, valenceTravelHalfExtent } from "@/lib/stance/pad-geometry";
import { IDBFactory } from "fake-indexeddb";
import { ComposeWizard } from "./wizard-view";
import { byAnyTestId, byNode } from "@/test/data-node";

const push = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

const server = startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

/** An in-memory draft store, so the flow's persistence is observable. */
function fakeDrafts(initial: WizardState | null = null): ComposeDraftStore & {
  held: () => WizardState | null;
} {
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
    held: () => held,
  };
}

/** jsdom has no canvas and no WebP encoder, so the encode is stubbed whole. */
function installEncoder() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1200, height: 1500, close: () => {} })),
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
      return new Blob([new Uint8Array(8) as BlobPart], { type });
    }
  }
  vi.stubGlobal("OffscreenCanvas", Canvas);
  // jsdom defines no object-URL statics. They are added to the REAL `URL` —
  // replacing the global outright would take the constructor with it, and
  // everything that builds a request from a string needs that constructor.
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:preview",
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
}

const preparePost = (node = "post-1") =>
  gqlLink.mutation("PreparePost", () =>
    HttpResponse.json({
      data: {
        preparePost: {
          __typename: "PrepareContentPayload",
          node,
          writes: [
            {
              __typename: "PreparedWrite",
              id: "w1",
              family: "PUBLISH",
              canonicalProposal: "AA==",
              gcAfterEpochs: 3,
            },
          ],
          userErrors: [],
        },
      },
    }),
  );

const uploadOk = (ids: string[]) => {
  let next = 0;
  return gqlLink.mutation("UploadMedia", () =>
    HttpResponse.json({
      data: {
        uploadMedia: {
          __typename: "UploadMediaPayload",
          media: echoedMedia(ids[Math.min(next++, ids.length - 1)]!),
          userErrors: [],
        },
      },
    }),
  );
};

// The device's upload digest, pinned so the server above can echo it
// (test/media-echo.ts).
vi.mock("@/lib/api/media-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/media-api")>()),
  uploadDigestOf: async () => "ee".repeat(32),
}));

async function pick(names: string[]) {
  // The screen is behind the draft lookup, so the picker exists only once that
  // has answered.
  const input = await screen.findByTestId("wizard-file-input");
  const files = names.map(
    (name) => new File([new Uint8Array([1, 2, 3]) as BlobPart], name, { type: "image/jpeg" }),
  );
  // `files` is read-only on the element, so the picked set is installed the way
  // a real change event carries it.
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
  // The screening reads each file's bytes — the container sniff, the animated
  // GIF check — before anything joins the draft, so the pick lands a microtask
  // after the change event rather than during it.
  await act(async () => {});
}

function render(drafts = fakeDrafts(), keyed = true) {
  return renderWithProviders(
    <ComposeWizard
      store={fakeIdentityStore({ keyOnDevice: keyed })}
      drafts={drafts}
      // A store of its own per render, over a fresh database (`beforeEach`),
      // so no copy one test seals is settled by the next.
      seals={createSealedDraftStore({ activeAccountId: () => "acct-1" })}
    />,
    { store: signedInStore(), writeSigner: fakeWriteSigner() },
  );
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  installEncoder();
  searchParams = new URLSearchParams();
  push.mockClear();
  // Every stage rides a history entry, and jsdom's history outlives a test:
  // the last test's traversals are let finish, and its marks are cleared, so
  // this one opens on a plain entry the way a real visit does.
  await new Promise((resolve) => setTimeout(resolve, 20));
  window.history.replaceState(null, "");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the compose wizard", () => {
  it("publishes a words post without ever showing a crop screen", async () => {
    let variables: {
      input: { content: string | null; attachments: unknown; pDirected: unknown };
    } | null = null;
    server.use(
      gqlLink.mutation("PreparePost", ({ variables: v }) => {
        variables = v as never;
        return HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: "post-1",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "PUBLISH",
                  canonicalProposal: "AA==",
                  gcAfterEpochs: 3,
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    render();

    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), {
      target: { value: "Three weekends at low tide." },
    });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    // Straight to details: there is nothing to crop.
    expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    fireEvent.click(await screen.findByTestId("wizard-sign"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/post-1?published=1"));
    expect(variables!.input.content).toBe("Three weekends at low tide.");
    // The XOR, on the wire: a words post carries no gallery at all.
    expect(variables!.input.attachments).toBeNull();
    // The stance the seal showed is the one on the wire (here the untouched
    // default, which the wizard states explicitly rather than leaving absent).
    expect(variables!.input.pDirected).toBe(DEFAULT_P_DIRECTED);
  });

  // ComposePad.md (round 15): Set at exactly 0.00 asks `Start it
  // unreachable?` over the parked pad, warns and never refuses; any other
  // pick sets without a word.
  it("asks Start it unreachable? at a Set of exactly 0.00, and signs the zero when set anyway", async () => {
    let variables: { input: { pDirected: unknown } } | null = null;
    server.use(
      gqlLink.mutation("PreparePost", ({ variables: v }) => {
        variables = v as never;
        return HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: "post-1",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "PUBLISH",
                  canonicalProposal: "AA==",
                  gcAfterEpochs: 3,
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), {
      target: { value: "Three weekends at low tide." },
    });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    await screen.findByTestId(byNode("composeDetails.title.input"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    // A non-zero Set closes the pad at once.
    fireEvent.click(await screen.findByTestId("wizard-open-stance"));
    const strip = screen.getByTestId("wizard-stance-field-strip");
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    fireEvent.click(screen.getByTestId("wizard-stance-set"));
    expect(screen.getByTestId("wizard-unreachable")).not.toHaveAttribute("open");
    expect(screen.getByTestId("wizard-stance-pad")).not.toHaveAttribute("open");
    expect(screen.getByTestId("wizard-stance-value").textContent).toContain("+0.15");

    // Down to exactly 0.00: the question stands over the pad, which stays.
    fireEvent.click(screen.getByTestId("wizard-open-stance"));
    for (let press = 0; press < 3; press += 1) {
      fireEvent.keyDown(screen.getByTestId("wizard-stance-field-strip"), { key: "ArrowLeft" });
    }
    expect(screen.getByTestId("wizard-stance-pick-face").textContent).toBe("🤔");
    fireEvent.click(screen.getByTestId("wizard-stance-set"));
    expect(screen.getByTestId("wizard-unreachable")).toHaveAttribute("open");
    expect(screen.getByTestId("wizard-stance-pad")).toHaveAttribute("open");

    // Keep adjusting: back to the pad at the same pick, nothing set.
    fireEvent.click(screen.getByTestId("wizard-unreachable-keep"));
    expect(screen.getByTestId("wizard-unreachable")).not.toHaveAttribute("open");
    expect(screen.getByTestId("wizard-stance-pad")).toHaveAttribute("open");
    expect(screen.getByTestId("wizard-stance-pick-face").textContent).toBe("🤔");
    expect(screen.getByTestId("wizard-stance-value").textContent).toContain("+0.15");

    // Set it anyway: both close, and the row reads the zero.
    fireEvent.click(screen.getByTestId("wizard-stance-set"));
    fireEvent.click(screen.getByTestId("wizard-unreachable-anyway"));
    expect(screen.getByTestId("wizard-unreachable")).not.toHaveAttribute("open");
    expect(screen.getByTestId("wizard-stance-pad")).not.toHaveAttribute("open");
    expect(screen.getByTestId("wizard-stance-value").textContent).toContain("🤔");
    expect(screen.getByTestId("wizard-stance-value").textContent).toContain("+0.00");

    fireEvent.click(screen.getByTestId("wizard-sign"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/post-1?published=1"));
    // The pick is never refused: the zero travels as picked.
    expect(variables!.input.pDirected).toBe(0);
  });

  // ComposePad.md: release lands the pick on the nearest hundredth. The pad
  // opens at +0.10 and a drag is float travel, so before the snap a drag could
  // never reach EXACTLY 0 — the 🤔 and the question were unreachable by hand.
  it("lands a drag released near zero on exactly 0.00, so Set asks Start it unreachable?", async () => {
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), {
      target: { value: "Three weekends at low tide." },
    });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    await screen.findByTestId(byNode("composeDetails.title.input"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    fireEvent.click(await screen.findByTestId("wizard-open-stance"));
    const strip = screen.getByTestId("wizard-stance-field-strip");
    const WIDTH = 300;
    strip.getBoundingClientRect = () => new DOMRect(0, 0, WIDTH, 56);
    const half = valenceTravelHalfExtent({ left: 0, top: 0, width: WIDTH, height: 56 }, KNOB_TRAVEL_INSET_PX);
    fireEvent.pointerDown(strip, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(strip, { pointerId: 1, clientX: (0.0031 - DEFAULT_P_DIRECTED) * half, clientY: 0 });
    // Under the thumb it is a float that prints +0.00 and smiles.
    expect(screen.getByTestId("wizard-stance-pick-face").textContent).not.toBe("🤔");
    fireEvent.pointerUp(strip, { pointerId: 1 });
    expect(screen.getByTestId("wizard-stance-pick-face").textContent).toBe("🤔");
    fireEvent.click(screen.getByTestId("wizard-stance-set"));
    expect(screen.getByTestId("wizard-unreachable")).toHaveAttribute("open");
  });

  // CW-26: WizardHeader.jsx's stageLabel slot draws at --text-label-small's
  // size and leading, at the ground's weight (the master sets none), and the
  // seal's one "?" stands after it, named "How signing works".
  it("labels the seal stage at the label-small size, then the seal's one help", async () => {
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), {
      target: { value: "Three weekends at low tide." },
    });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    await screen.findByTestId(byNode("composeDetails.title.input"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    const stage = await screen.findByText("Last step");
    expect(stage.className).toContain("text-[length:var(--text-label-small)]");
    expect(stage.className).not.toContain("text-label-small ");
    const help = screen.getByRole("button", { name: "How signing works" });
    expect(stage.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // The hand test found framing dead on everything past the first picture, so
  // what is asserted is that each one carries its OWN framing and keeps it.
  // The zoom is read off the cropper's own transform, which is the framing the
  // library renders from.
  const zoomOf = () => {
    const transform = screen
      .getByTestId("wizard-crop-frame")
      .querySelector("img")!.style.transform;
    return Number(/scale\(([\d.]+)\)/.exec(transform)?.[1]);
  };

  it("frames every picked picture, not just the first", async () => {
    render();
    await pick(["one.jpg", "two.jpg", "three.jpg"]);
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    // Each picture starts unzoomed and is framed on its own.
    for (const index of [0, 1, 2]) {
      fireEvent.click(screen.getByTestId(`wizard-crop-pick-${index}`));
      expect(zoomOf()).toBe(1);
      for (let press = 0; press <= index; press += 1) {
        fireEvent.keyDown(screen.getByTestId("wizard-crop-frame"), { key: "+" });
      }
    }

    // Coming back finds each one as it was left, so no picture's framing was
    // written over another's.
    for (const [index, expected] of [
      [0, 1.1],
      [1, 1.2],
      [2, 1.3],
    ] as const) {
      fireEvent.click(screen.getByTestId(`wizard-crop-pick-${index}`));
      expect(zoomOf()).toBeCloseTo(expected, 6);
    }
  });

  // Switching shape re-frames against the ORIGINAL: the rectangle is measured
  // anew at the new ratio, while where the reader had put the picture stays.
  it("re-frames against the original across a shape switch, keeping the zoom", async () => {
    render();
    await pick(["one.jpg", "two.jpg"]);
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    fireEvent.click(screen.getByTestId("wizard-crop-pick-1"));
    fireEvent.keyDown(screen.getByTestId("wizard-crop-frame"), { key: "+" });
    fireEvent.click(screen.getByTestId("wizard-shape-wide"));

    const frame = screen.getByTestId("wizard-crop-frame");
    expect(frame.style.aspectRatio).toBe("1.91 / 1");
    expect(zoomOf()).toBeCloseTo(1.1, 6);
    // The picture the cropper works from is the picked original, never a
    // rectangle a previous shape left behind.
    expect(frame.querySelector("img")!.getAttribute("src")).toBe("blob:preview");
  });

  // ComposeCrop.md: the zoom slider under the cut, the cut named for what it
  // does (crop-frame.test.tsx, where the cut can be measured), and the
  // QuietNote's how-to line for the device in hand.
  it("draws the crop's zoom slider and its how-to line", async () => {
    render();
    await pick(["one.jpg", "two.jpg"]);
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    expect(screen.getByRole("slider", { name: "Zoom" })).toBeInTheDocument();
    const note = screen.getByTestId("wizard-crop-note");
    expect(note.className).toContain("text-label-small");
    // The phone's sentence where a touch can pinch.
    expect(note).toHaveTextContent("One shape for the whole post. Drag to move, pinch to zoom.");
  });

  it("names the desktop's ways to move and zoom where no touch can pinch", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      render();
      await pick(["one.jpg"]);
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
      expect(screen.getByTestId("wizard-crop-note")).toHaveTextContent(
        "One shape for the whole post. Drag or use the arrow keys to move, the slider to zoom.",
      );
    } finally {
      window.matchMedia = original;
    }
  });

  // ComposeWords.md: an empty body holds Next inert, and nothing else is said
  // — the refusal line and the error outline belong to the cap alone.
  it("refuses to leave the pick screen with no body, saying nothing", async () => {
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    expect(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next"))).toBeDisabled();
    expect(screen.queryByTestId("wizard-body-error")).toBeNull();
    // Still on the pick screen.
    expect(screen.getByTestId("wizard-words")).toBeInTheDocument();
  });

  it("uploads each picture and attaches them in the order they were picked", async () => {
    let variables: {
      input: {
        attachments: {
          mediaId: string;
          displayOrder: number;
          isCover: boolean;
          altText: string | null;
          coverMediaId: string | null;
          coverTaken: boolean | null;
        }[];
      };
    } | null = null;
    server.use(
      uploadOk(["m-a", "m-b"]),
      gqlLink.mutation("PreparePost", ({ variables: v }) => {
        variables = v as never;
        return HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: "post-1",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "PUBLISH",
                  canonicalProposal: "AA==",
                  gcAfterEpochs: 3,
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    render();

    await pick(["one.jpg", "two.jpg"]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    // The crop screen carries no keyboard: a description is written over the
    // details step, never here (design/readme.md §"The media slice").
    expect(screen.queryByTestId("wizard-alt-text")).toBeNull();
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    // Uploads run from here; the seal opens only once they are done.
    expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();

    // The describe counter is the way in, and it opens the sheet on a picture.
    fireEvent.click(screen.getByTestId(byNode("composeDetails.describeRow.describe")));
    fireEvent.change(await screen.findByTestId("wizard-describe-sheet-field"), {
      target: { value: "paper against the salt crust" },
    });
    fireEvent.click(screen.getByTestId("wizard-describe-sheet-done"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    await waitFor(() => expect(screen.getByTestId("wizard-sign")).not.toBeDisabled());

    fireEvent.click(screen.getByTestId("wizard-sign"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/post-1?published=1"));

    // The description rides the attachment, not the upload: it was typed
    // long after the bytes were already stored, and it still reaches the
    // record that the signature covers. A picture is covered by nothing, so
    // every placement here names a null poster rather than omitting one.
    expect(variables!.input.attachments).toEqual([
      {
        mediaId: "m-a",
        displayOrder: 0,
        isCover: true,
        altText: "paper against the salt crust",
        coverMediaId: null,
        coverTaken: null,
      },
      {
        mediaId: "m-b",
        displayOrder: 1,
        isCover: false,
        altText: null,
        coverMediaId: null,
        coverTaken: null,
      },
    ]);
  });

  it("holds the seal shut while a picture is unresolved, and retries just that one", async () => {
    let attempts = 0;
    server.use(
      gqlLink.mutation("UploadMedia", () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({
            data: {
              uploadMedia: {
                __typename: "UploadMediaPayload",
                media: null,
                userErrors: [
                  { __typename: "UserError", message: "too many uploads", code: "RATE_LIMITED", field: null },
                ],
              },
            },
          });
        }
        return HttpResponse.json({
          data: {
            uploadMedia: {
              __typename: "UploadMediaPayload",
              media: echoedMedia("m-retried"),
              userErrors: [],
            },
          },
        });
      }),
    );
    render();

    await pick(["one.jpg"]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    // ComposeUploading.md: the board's own line on the details screen, with
    // the retry beside it — a failure that can be tried again is said the
    // same way whatever the network answered.
    expect(await screen.findByTestId("wizard-upload-error")).toHaveTextContent(
      "One picture didn't upload.",
    );
    expect(screen.queryByText(/Too many attempts/)).toBeNull();
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    expect(await screen.findByTestId("wizard-seal-blocked")).toHaveTextContent(
      "One picture didn't upload",
    );
    expect(screen.getByTestId("wizard-sign")).toBeDisabled();

    // Back to the details screen to retry the one that failed.
    fireEvent.click(screen.getByTestId("wizard-back"));
    fireEvent.click(await screen.findByTestId("wizard-upload-error-retry"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    // The commit stays live while the retried picture goes up (the gate holds a
    // press, ComposeSealUploading.md); it is the second attempt that lands.
    await waitFor(() => expect(attempts).toBe(2));
    await waitFor(() => expect(screen.queryByTestId("wizard-seal-blocked")).toBeNull());
    expect(screen.getByTestId("wizard-sign")).not.toBeDisabled();
  });

  it("keeps the draft and says nothing was spent when the batch expires", async () => {
    const drafts = fakeDrafts();
    server.use(preparePost());
    renderWithProviders(
      <ComposeWizard store={fakeIdentityStore({ keyOnDevice: true })} drafts={drafts} />,
      {
        store: signedInStore(),
        writeSigner: fakeWriteSigner({
          signStaged: async () => ({
            kind: "refused",
            id: "w1",
            errors: [
              { message: "garbage-collected unlanded", code: "STAGED_WRITE_EXPIRED", field: null },
            ],
          }),
        }),
      },
    );

    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "words" } });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    fireEvent.click(await screen.findByTestId("wizard-sign"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed?compose=expired"));
    // The notice's promise, made true here rather than in its own copy.
    expect(drafts.held()?.words).toBe("words");
  });

  it("offers a keyless browser the restore route instead of a sign button", async () => {
    render(fakeDrafts(), false);
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "words" } });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    expect(await screen.findByTestId("wizard-key-absent")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-sign")).not.toBeInTheDocument();
    expect(screen.getByTestId("wizard-keep-draft")).toBeInTheDocument();
  });

  // CW-40: the graph draws ComposeKeyAbsent's keep-draft edge as a terminal
  // `back` — it leaves the wizard, keeping the draft, rather than stepping
  // back to the details screen the way the ordinary seal's Back does.
  it("leaves the wizard when a keyless seal's keep-draft is pressed, rather than stepping back", async () => {
    const drafts = fakeDrafts();
    render(drafts, false);
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "words" } });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    fireEvent.click(await screen.findByTestId("wizard-keep-draft"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    expect(drafts.held()?.words).toBe("words");
    // Not a step back: the details screen never reappears underneath.
    expect(screen.queryByTestId(byNode("composeDetails.title.input"))).not.toBeInTheDocument();
  });

  it("offers a held draft, and discarding it leaves a clean screen", async () => {
    const held: WizardState = {
      ...emptyWizard(),
      mode: "words",
      words: "an unfinished thought",
      title: "Salt maps",
    };
    const drafts = fakeDrafts(held);
    render(drafts);

    expect(await screen.findByTestId("wizard-draft-card")).toHaveTextContent("Salt maps");
    fireEvent.click(screen.getByTestId("wizard-draft-discard"));
    await waitFor(() => expect(drafts.held()).toBeNull());
    expect(screen.queryByTestId("wizard-draft-card")).not.toBeInTheDocument();
  });

  // CW-42 (ComposeDraft.jsx): the pick step underneath the offer is present,
  // dimmed to 55%, and not the subject — Android's ComposeWizardScreen.kt
  // gates the same alpha on `draftOffer != null`.
  it("dims the pick step and makes it inert while the draft offer shows, then restores it", async () => {
    const held: WizardState = {
      ...emptyWizard(),
      mode: "words",
      words: "an unfinished thought",
      title: "Salt maps",
    };
    const drafts = fakeDrafts(held);
    render(drafts);

    await screen.findByTestId("wizard-draft-card");
    const region = screen.getByTestId("wizard-pick-region");
    // Dimmed AND inert, not opacity alone — a stray tab or click must not
    // land on a grid the draft's own Continue/Discard pair is meant to
    // decide for the author.
    expect(region).toHaveAttribute("inert");
    expect(region).toHaveStyle({ opacity: "0.55" });

    fireEvent.click(screen.getByTestId("wizard-draft-discard"));
    await waitFor(() => expect(drafts.held()).toBeNull());
    expect(region).not.toHaveAttribute("inert");
    expect(region).not.toHaveStyle({ opacity: "0.55" });
  });

  // CW-43 (jakob 2026-08-31, design-session-answers q26, readme §13): the
  // ruled short form ends on its own dash — the pick screen right below is
  // already the rest of the sentence.
  it("names the fresh-start route in the ruled short form", async () => {
    const held: WizardState = {
      ...emptyWizard(),
      mode: "words",
      words: "an unfinished thought",
      title: "Salt maps",
    };
    render(fakeDrafts(held));

    // Exact text, not a substring match: the old full sentence also started
    // with these same words, which is exactly the regression this pins.
    expect((await screen.findByTestId("wizard-draft-fresh")).textContent).toBe(
      "Or start fresh —",
    );
  });

  // -- The Reference affordance (D20) --

  // "Cite in a new post" STAGES the node, it does not merely offer it: the
  // chip is on the details step when the author gets there, removable like
  // any picked one.
  it("stages the node the cite affordance sent it, and resolves its label", async () => {
    searchParams = new URLSearchParams("reference=p-quoted");
    server.use(
      gqlLink.query("ReferenceCandidates", () =>
        HttpResponse.json({
          data: {
            referenceCandidates: [
              {
                __typename: "ReferenceCandidate",
                targetId: "p-quoted",
                target: {
                  __typename: "Post",
                  id: "p-quoted",
                  title: { __typename: "ModeratedText", value: "On folding" },
                  content: { __typename: "ModeratedText", value: "body" },
                  author: { __typename: "User", handle: "carol" },
                  createdAt: "2026-10-25T10:00:00Z",
                  attachmentsStatus: "NORMAL",
                  attachments: [],
                },
              },
            ],
          },
        }),
      ),
    );
    render();

    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "words" } });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    expect(await screen.findByTestId(byNode("composeDetails.references.stagedReference", "1"))).toHaveTextContent(
      "@carol: On folding",
    );
  });

  // THE TAG CARD'S ACT (`Tag a new post with it`, History.md:63): the
  // composer opens at its first stage, the tag riding staged among the new
  // post's tags.
  it("stages the tag the tag card's act sent it", async () => {
    searchParams = new URLSearchParams("tag=saltmaps");
    render();

    expect(await screen.findByTestId("wizard-to-words")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "words" } });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    expect(await screen.findByTestId(byNode("composeDetails.tags.tag", "saltmaps"))).toHaveTextContent("saltmaps");
  });

  // A TARGET THE LOOKUP CANNOT TYPE IS STILL STAGED: the citation names its
  // target by id, so dropping the author's gesture silently would be worse
  // than a chip with no label.
  it("stages an unresolvable cite target by its id", async () => {
    searchParams = new URLSearchParams("reference=p-quoted");
    server.use(
      gqlLink.query("ReferenceCandidates", () =>
        HttpResponse.json({ data: { referenceCandidates: [] } }),
      ),
    );
    render();

    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "words" } });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    expect(await screen.findByTestId(byNode("composeDetails.references.stagedReference", "1"))).toHaveTextContent("p-quoted");
  });

  // The draft answers a different question — what the author was writing
  // last week — so taking it up must not undo the gesture that opened the
  // wizard.
  it("keeps the staged cite when a held draft is taken up", async () => {
    searchParams = new URLSearchParams("reference=p-quoted");
    server.use(
      gqlLink.query("ReferenceCandidates", () =>
        HttpResponse.json({ data: { referenceCandidates: [] } }),
      ),
    );
    const held: WizardState = {
      ...emptyWizard(),
      mode: "words",
      words: "an unfinished thought",
      step: "details",
    };
    render(fakeDrafts(held));

    fireEvent.click(await screen.findByTestId("wizard-draft-continue"));
    expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("composeDetails.references.stagedReference", "1"))).toHaveTextContent("p-quoted");
  });

  it("restores a held draft on the step it was left on", async () => {
    const held: WizardState = {
      ...emptyWizard(),
      mode: "words",
      words: "an unfinished thought",
      step: "details",
    };
    render(fakeDrafts(held));

    fireEvent.click(await screen.findByTestId("wizard-draft-continue"));
    expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
  });

  // The fix-round-2 ruling: the draft is kept continuously, and the only thing
  // that discards it is the offer's own Discard.
  it("holds what was typed without waiting to be told to", async () => {
    const drafts = fakeDrafts();
    render(drafts);

    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), {
      target: { value: "half a thought" },
    });

    await waitFor(() => expect(drafts.held()?.words).toBe("half a thought"));
  });

  it("hands the draft to disk when the tab goes away", async () => {
    const drafts = fakeDrafts();
    render(drafts);

    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "unsaved yet" } });
    // The coalescing window has not elapsed; the tab going away must not wait
    // for it. `pagehide` rather than `beforeunload`, which mobile does not fire.
    window.dispatchEvent(new Event("pagehide"));

    await waitFor(() => expect(drafts.held()?.words).toBe("unsaved yet"));
  });

  it("keeps the draft when the reader simply leaves", async () => {
    const drafts = fakeDrafts();
    render(drafts);

    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "come back to me" } });
    fireEvent.click(screen.getByTestId(byAnyTestId("header-back", "composeDetails.header.back")));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    expect(drafts.held()?.words).toBe("come back to me");
  });

  // jakob's hand test, round 6: he reached for Next in the top-right corner on
  // a later stage and hit the X, leaving the flow. The corner used to mean Next
  // early and X from Details on; it now means only X, and Next is at the bottom
  // of every stage's own content.
  describe("the forward action, and the corner it is no longer in", () => {
    const forward = () => screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next"));
    const inHeader = () => screen.getByTestId(byAnyTestId("wizard-header", "composeDetails.header")).contains(forward());

    it("keeps Next out of the header on the words stage", async () => {
      render();
      fireEvent.click(await screen.findByTestId("wizard-to-words"));
      expect(inHeader()).toBe(false);
    });

    it("keeps Next out of the header on the pick, crop and details stages", async () => {
      render();
      await pick(["one.jpg"]);
      expect(inHeader()).toBe(false);

      fireEvent.click(forward());
      expect(await screen.findByTestId("wizard-crop-frame")).toBeInTheDocument();
      expect(inHeader()).toBe(false);

      fireEvent.click(forward());
      expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
      expect(inHeader()).toBe(false);
    });

    it("leaves the corner holding nothing but the ways out", async () => {
      render();
      await pick(["one.jpg"]);
      const header = screen.getByTestId(byAnyTestId("wizard-header", "composeDetails.header"));
      // The arrow steps back, the X leaves — and nothing else is up there to
      // be mistaken for either of them.
      expect(header.querySelectorAll("button")).toHaveLength(2);
      expect(screen.getByTestId(byAnyTestId("header-back", "composeDetails.header.back"))).toBeInTheDocument();
      expect(screen.getByTestId(byAnyTestId("header-leave", "composeDetails.header.leave"))).toBeInTheDocument();
    });
  });

  // jakob, round 6: "when returning to the crop section ... the crop should be
  // 'remembered' so the user sees his current crop and does not need to
  // restart". The reducer never dropped the framing; what could lose it is the
  // crop stage being unmounted and mounted again, which is what every arrival
  // does.
  describe("returning to the crop stage", () => {
    it("finds the framing waiting, arriving from the stage after it", async () => {
      render();
      await pick(["one.jpg"]);
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

      fireEvent.keyDown(screen.getByTestId("wizard-crop-frame"), { key: "+" });
      fireEvent.keyDown(screen.getByTestId("wizard-crop-frame"), { key: "+" });
      expect(zoomOf()).toBeCloseTo(1.2, 6);

      // On to the details, then back a step with the arrow.
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
      expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
      fireEvent.click(screen.getByTestId(byAnyTestId("header-back", "composeDetails.header.back")));

      expect(await screen.findByTestId("wizard-crop-frame")).toBeInTheDocument();
      expect(zoomOf()).toBeCloseTo(1.2, 6);
    });

    it("finds it waiting again, arriving from the stage before it", async () => {
      render();
      await pick(["one.jpg"]);
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
      fireEvent.keyDown(screen.getByTestId("wizard-crop-frame"), { key: "+" });
      expect(zoomOf()).toBeCloseTo(1.1, 6);

      // All the way back to the pick screen, then forward into crop again.
      fireEvent.click(screen.getByTestId(byAnyTestId("header-back", "composeDetails.header.back")));
      expect(await screen.findByTestId("wizard-drop")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

      expect(await screen.findByTestId("wizard-crop-frame")).toBeInTheDocument();
      expect(zoomOf()).toBeCloseTo(1.1, 6);
    });

    it("holds each picture's own framing across the round trip", async () => {
      render();
      await pick(["one.jpg", "two.jpg"]);
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

      fireEvent.click(screen.getByTestId("wizard-crop-pick-1"));
      fireEvent.keyDown(screen.getByTestId("wizard-crop-frame"), { key: "+" });
      fireEvent.keyDown(screen.getByTestId("wizard-crop-frame"), { key: "+" });
      fireEvent.keyDown(screen.getByTestId("wizard-crop-frame"), { key: "+" });

      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
      expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
      fireEvent.click(screen.getByTestId(byAnyTestId("header-back", "composeDetails.header.back")));

      // The stage comes back on the picture it was left on, framed as it was,
      // and the one nobody touched is still untouched.
      expect(await screen.findByTestId("wizard-crop-frame")).toBeInTheDocument();
      expect(zoomOf()).toBeCloseTo(1.3, 6);
      fireEvent.click(screen.getByTestId("wizard-crop-pick-0"));
      expect(zoomOf()).toBe(1);
    });
  });

  // jakob, round 6: "the previews on the next pages afterwards should display
  // the cropped version so that people dont think it has reset".
  it("draws the framing, not the source, on the stages after the crop", async () => {
    // The framing arrives through a restored draft: jsdom measures every
    // element as 0x0, so the real cropper can report no rectangle here — and a
    // restored draft is the surface where a stale-looking preview would read
    // worst anyway.
    server.use(uploadOk(["m1"]));
    const framed = new File([new Uint8Array([1]) as BlobPart], "one.jpg", { type: "image/jpeg" });
    const drafts = fakeDrafts({
      ...emptyWizard(),
      step: "details",
      mode: "media",
      assets: [
        {
          id: "a0",
          file: framed,
          altText: "",
          upload: { kind: "waiting" },
          crop: {
            x: 0,
            y: 0,
            zoom: 1,
            area: { x: 0, y: 100, width: 800, height: 500 },
            areaPercent: { x: 0, y: 10, width: 100, height: 50 },
          },
        },
      ],
    });
    render(drafts);

    fireEvent.click(await screen.findByTestId("wizard-draft-continue"));

    // The details row draws the band the author framed…
    const rowThumb = await screen.findByTestId("wizard-picked-row-thumb-0-image");
    expect(rowThumb).toHaveAttribute("data-framed", "true");

    // …and so does the Show all sheet the row opens.
    fireEvent.click(screen.getByTestId(byNode("composeDetails.mediaRow")));
    expect(await screen.findByTestId("wizard-picked-sheet-thumb-0-image")).toHaveAttribute(
      "data-framed",
      "true",
    );
  });

  // THE LAST × GIVES THE PICK STEP BACK (jakob's ruling, 2026-09-23; design
  // commit 27aaa1cb, `ComposePicked.jsx`/`ComposeDetails.jsx` docblocks):
  // removing the manager's last picture closes it and returns the pick
  // step, tray empty — the way the video path's own × already does — with
  // the staged title/description/tags/references kept in the draft.
  it("closes the manager and gives the pick step back when the last picture leaves it", async () => {
    server.use(uploadOk(["m1", "m2"]));
    const p1 = new File([new Uint8Array([1]) as BlobPart], "one.jpg", { type: "image/jpeg" });
    const p2 = new File([new Uint8Array([2]) as BlobPart], "two.jpg", { type: "image/jpeg" });
    const CROP = { x: 0, y: 0, zoom: 1, area: null, areaPercent: null };
    const drafts = fakeDrafts({
      ...emptyWizard(),
      step: "details",
      mode: "media",
      title: "Salt maps",
      assets: [
        { id: "p1", file: p1, altText: "", upload: { kind: "waiting" }, crop: CROP },
        { id: "p2", file: p2, altText: "", upload: { kind: "waiting" }, crop: CROP },
      ],
    });
    render(drafts);

    fireEvent.click(await screen.findByTestId("wizard-draft-continue"));
    await screen.findByTestId(byNode("composeDetails.title.input"));

    fireEvent.click(screen.getByTestId(byNode("composeDetails.mediaRow")));
    await screen.findByTestId("wizard-picked-sheet-remove-0");

    // One removed, one left — the manager stays open and the details stage
    // is untouched.
    fireEvent.click(screen.getByTestId("wizard-picked-sheet-remove-0"));
    expect(screen.getByTestId("wizard-picked-sheet-remove-0")).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();

    // The last one leaves: the manager closes, and Details never stands on
    // an empty body — the pick step comes back with the tray empty.
    fireEvent.click(screen.getByTestId("wizard-picked-sheet-remove-0"));

    expect(await screen.findByTestId("wizard-drop")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-picked-count")).toBeNull();
    expect(screen.queryByTestId(byNode("composeDetails.title.input"))).toBeNull();

    // The staged title stays in the draft, waiting for a body — the stage
    // never becomes the words path. Checked together in one `waitFor`: the
    // debounced autosave fires more than once (an intermediate save can
    // still carry the pre-removal asset count), and title alone would be
    // satisfied by a stale one — waiting on both pins the FINAL save.
    await waitFor(() => {
      expect(drafts.held()?.title).toBe("Salt maps");
      expect(drafts.held()?.assets).toHaveLength(0);
    });
    expect(drafts.held()?.mode).toBe("media");
  });

  // jakob's hand test, 2026-09-23 (Pixel 6, Chrome): the left-edge back
  // gesture inside the wizard dropped him on the page he came from. The law
  // is design/readme.md's — the arrow steps ONE STAGE BACK, "the platform
  // back gesture does the same" — and Android's BackHandler already obeys it.
  describe("the browser's back and forward", () => {
    const stageDepth = () =>
      (window.history.state as { cograStage?: { depth: number } } | null)?.cograStage?.depth ?? 0;

    async function toSeal() {
      fireEvent.click(await screen.findByTestId("wizard-to-words"));
      fireEvent.change(screen.getByTestId("wizard-words"), {
        target: { value: "Three weekends at low tide." },
      });
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
      await screen.findByTestId(byNode("composeDetails.title.input"));
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
      await screen.findByText("Last step");
    }

    it("steps back one stage per press, and leaves the pick to the browser", async () => {
      render();
      await toSeal();
      expect(stageDepth()).toBe(2);

      window.history.back();
      expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
      expect(screen.queryByText("Last step")).toBeNull();

      window.history.back();
      expect(await screen.findByTestId("wizard-words")).toBeInTheDocument();
      expect(screen.queryByTestId(byNode("composeDetails.title.input"))).toBeNull();
      // The pick is the arrival entry: the next Back is the browser's own, so
      // the wizard pushes no route of its own on the way.
      expect(push).not.toHaveBeenCalled();
      expect(stageDepth()).toBe(0);
    });

    it("reaches the crop from the details, as the arrow does", async () => {
      server.use(uploadOk(["m1"]));
      render();
      await pick(["one.jpg"]);
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
      await screen.findByTestId("wizard-crop-frame");
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
      await screen.findByTestId(byNode("composeDetails.title.input"));

      window.history.back();
      expect(await screen.findByTestId("wizard-crop-frame")).toBeInTheDocument();
      expect(screen.queryByTestId(byNode("composeDetails.title.input"))).toBeNull();
    });

    it("keeps the history in step with the arrow", async () => {
      render();
      await toSeal();

      fireEvent.click(screen.getByTestId(byAnyTestId("header-back", "composeDetails.header.back")));
      await screen.findByTestId(byNode("composeDetails.title.input"));
      await waitFor(() => expect(stageDepth()).toBe(1));
      // Settled: the arrow's own traversal stepped nothing further.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.getByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
    });

    it("re-advances on Forward, through the stage's own gate", async () => {
      render();
      await toSeal();
      window.history.back();
      await screen.findByTestId(byNode("composeDetails.title.input"));

      window.history.forward();
      expect(await screen.findByText("Last step")).toBeInTheDocument();
      expect(stageDepth()).toBe(2);
    });

    it("closes an open sheet on Back before any stage steps back", async () => {
      const p1 = new File([new Uint8Array([1]) as BlobPart], "one.jpg", { type: "image/jpeg" });
      const CROP = { x: 0, y: 0, zoom: 1, area: null, areaPercent: null };
      server.use(uploadOk(["m1"]));
      render(
        fakeDrafts({
          ...emptyWizard(),
          step: "details",
          mode: "media",
          assets: [{ id: "p1", file: p1, altText: "", upload: { kind: "waiting" }, crop: CROP }],
        }),
      );
      fireEvent.click(await screen.findByTestId("wizard-draft-continue"));
      await screen.findByTestId(byNode("composeDetails.title.input"));
      // A draft restored on the details is three stages deep, and Back walks
      // all three of them — the same ladder the arrow walks.
      await waitFor(() => expect(stageDepth()).toBe(2));

      fireEvent.click(screen.getByTestId(byNode("composeDetails.mediaRow")));
      expect(screen.getByTestId("wizard-picked-sheet")).toHaveAttribute("open");

      window.history.back();
      await waitFor(() =>
        expect(screen.getByTestId("wizard-picked-sheet")).not.toHaveAttribute("open"),
      );
      expect(screen.getByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
      await waitFor(() => expect(stageDepth()).toBe(2));

      window.history.back();
      expect(await screen.findByTestId("wizard-crop-frame")).toBeInTheDocument();
    });
  });
});

// SettingsLicense.md: a new post starts from the account's default license.
describe("the license a new post starts from", () => {
  it("new_post_starts_from_the_default", async () => {
    server.use(
      gqlLink.query("DefaultLicense", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              preferences: {
                __typename: "UserPreferences",
                defaultLicense: { __typename: "License", attribution: 1, provenance: 0 },
              },
            },
          },
        }),
      ),
    );
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), {
      target: { value: "Three weekends at low tide." },
    });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    await screen.findByTestId(byNode("composeDetails.title.input"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    await screen.findByText("Last step");
    // The seal's License row reads the seeded pair, never public domain.
    const licenseRow = screen.getByTestId("wizard-open-license").parentElement!;
    await waitFor(() => expect(licenseRow).toHaveTextContent("Credit always"));
    expect(licenseRow).toHaveTextContent("every use credits you");
    expect(licenseRow).not.toHaveTextContent("Public domain");
  });

  it("a draft taken up keeps the license it was written under", async () => {
    server.use(
      gqlLink.query("DefaultLicense", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              preferences: {
                __typename: "UserPreferences",
                defaultLicense: { __typename: "License", attribution: 1, provenance: 0 },
              },
            },
          },
        }),
      ),
    );
    const drafts = fakeDrafts({
      ...emptyWizard(),
      mode: "words",
      words: "Kept words.",
      license: { attribution: 0, provenance: 1 },
    });
    render(drafts);
    fireEvent.click(await screen.findByTestId("wizard-draft-continue"));
    await waitFor(() => expect(drafts.held()?.license).toEqual({ attribution: 0, provenance: 1 }));
  });
});

// FC-G5, ruled "fix the BUILD, not the board": taken is not landed, and the
// draft ComposeExpired.md:3 promises must still exist when a relaying post
// expires epochs after the wizard left. These run on the REAL stores over a
// fresh in-memory IndexedDB, because the custody being proven is the stores'.
describe("the sealed copy of a staged post (FC-G5)", () => {
  const ACCOUNT = "acct-1";

  let realDrafts: ComposeDraftStore;
  let seals: SealedDraftStore;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    realDrafts = createComposeDraftStore({ activeAccountId: () => ACCOUNT });
    seals = createSealedDraftStore({ activeAccountId: () => ACCOUNT });
  });

  const stagedWriteIs = (state: string | null) =>
    gqlLink.query("StagedWrite", ({ variables }) =>
      HttpResponse.json({
        data: {
          stagedWrite:
            state === null
              ? null
              : {
                  __typename: "StagedWrite",
                  id: variables.id,
                  state,
                  carried: false,
                  family: "PUBLISH",
                  canonicalProposal: "AA==",
                  verifiedAct: null,
                  record: null,
                },
        },
      }),
    );

  function mount(signer = fakeWriteSigner()) {
    return renderWithProviders(
      <ComposeWizard
        store={fakeIdentityStore({ keyOnDevice: true })}
        drafts={realDrafts}
        seals={seals}
      />,
      { store: signedInStore(), writeSigner: signer },
    );
  }

  async function publishWords(words: string) {
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: words } });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    fireEvent.click(await screen.findByTestId("wizard-sign"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/post-1?published=1"));
  }

  const staged: WizardState = {
    ...emptyWizard(),
    mode: "words",
    words: "Three weekends at low tide.",
    title: "Salt maps",
    step: "seal",
  };

  it("a_staged_post_keeps_a_sealed_copy_until_it_lands", async () => {
    server.use(preparePost());
    // The default signer answers RELAYING: taken, not landed.
    mount();
    await publishWords("Three weekends at low tide.");

    // jakob 2026-08-31 still holds — the composer has no draft…
    expect(await realDrafts.load()).toBeNull();
    // …because the post's draft is SEALED, out of its reach.
    const copies = await seals.list();
    expect(copies).toHaveLength(1);
    expect(copies[0]!.node).toBe("post-1");
    expect(copies[0]!.writes).toEqual(["w1"]);
    expect(copies[0]!.state.words).toBe("Three weekends at low tide.");
  });

  // The whole loss path, end to end: published while relaying, expired after
  // the wizard left, and the composer opened again.
  it("a post that expires after the wizard left comes back as the draft", async () => {
    server.use(preparePost());
    const first = mount();
    await publishWords("Three weekends at low tide.");
    first.unmount();

    server.use(stagedWriteIs("EXPIRED"));
    mount();
    expect(await screen.findByTestId("wizard-draft-card")).toHaveTextContent(
      "Three weekends at low tide.",
    );
  });

  it("a batch already landed at signing seals nothing and keeps no draft", async () => {
    server.use(preparePost());
    mount(
      fakeWriteSigner({
        signStaged: async (write) => ({ kind: "done", id: write.id, state: "LANDED" }),
      }),
    );
    await publishWords("Landed at once.");
    expect(await seals.list()).toHaveLength(0);
    expect(await realDrafts.load()).toBeNull();
  });

  it("never offers the copy while its write is still relaying", async () => {
    await seals.seal(staged, { node: "post-1", writes: ["w1"] });
    server.use(stagedWriteIs("RELAYING"));
    mount();

    expect(await screen.findByTestId("wizard-to-words")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-draft-card")).not.toBeInTheDocument();
    expect(await seals.list()).toHaveLength(1);
  });

  it("a_landed_post_purges_its_sealed_copy", async () => {
    await seals.seal(staged, { node: "post-1", writes: ["w1"] });
    server.use(stagedWriteIs("LANDED"));
    mount();

    expect(await screen.findByTestId("wizard-to-words")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-draft-card")).not.toBeInTheDocument();
    expect(await seals.list()).toHaveLength(0);
  });

  it("an_expired_post_restores_its_draft_and_open_the_draft_leads_with_it", async () => {
    await seals.seal(staged, { node: "post-1", writes: ["w1"] });
    server.use(stagedWriteIs("EXPIRED"));
    // "Open the draft" is a link to /compose: this mount IS that press.
    mount();

    expect(await screen.findByTestId("wizard-draft-card")).toHaveTextContent("Salt maps");
    expect(await seals.list()).toHaveLength(0);
    // Continue resumes on the stage it was sealed from, words intact.
    fireEvent.click(screen.getByTestId("wizard-draft-continue"));
    expect(await screen.findByTestId("wizard-sign")).toBeInTheDocument();
  });

  it("restores a post whose write the server has already reaped", async () => {
    await seals.seal(staged, { node: "post-1", writes: ["w1"] });
    server.use(stagedWriteIs(null));
    mount();
    expect(await screen.findByTestId("wizard-draft-card")).toHaveTextContent("Salt maps");
  });

  it("decides nothing when the fate cannot be read, and still opens", async () => {
    await seals.seal(staged, { node: "post-1", writes: ["w1"] });
    server.use(gqlLink.query("StagedWrite", () => HttpResponse.error()));
    mount();
    expect(await screen.findByTestId("wizard-to-words")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-draft-card")).not.toBeInTheDocument();
    expect(await seals.list()).toHaveLength(1);
  });

  it("a restored draft that is discarded stays discarded", async () => {
    await seals.seal(staged, { node: "post-1", writes: ["w1"] });
    server.use(stagedWriteIs("EXPIRED"));
    const first = mount();
    await screen.findByTestId("wizard-draft-card");
    fireEvent.click(screen.getByTestId("wizard-draft-discard"));
    await waitFor(async () => expect(await realDrafts.load()).toBeNull());
    first.unmount();

    mount();
    expect(await screen.findByTestId("wizard-to-words")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-draft-card")).not.toBeInTheDocument();
  });

  it("never overwrites a draft started since: the newer one leads, the copy waits sealed", async () => {
    await seals.seal(staged, { node: "post-1", writes: ["w1"] });
    await realDrafts.save({ ...emptyWizard(), mode: "words", words: "x", title: "A newer draft" });
    server.use(stagedWriteIs("EXPIRED"));
    mount();

    expect(await screen.findByTestId("wizard-draft-card")).toHaveTextContent("A newer draft");
    expect(await seals.list()).toHaveLength(1);
  });

// ComposeBodyDiscard: the body fork asks before it discards a body that holds
// something, and switches silently when it is empty.
describe("the body fork", () => {
  it("asks Discard the words? before trading written words for pictures", async () => {
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "Three weekends." } });
    fireEvent.click(screen.getByTestId("wizard-to-media"));
    const ask = await screen.findByTestId("wizard-body-discard");
    expect(within(ask).getByText("Discard the words?")).toBeInTheDocument();
    expect(within(ask).getByText("The rest of the draft stays.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wizard-body-keep"));
    expect(screen.getByTestId("wizard-words")).toHaveValue("Three weekends.");
    fireEvent.click(screen.getByTestId("wizard-to-media"));
    fireEvent.click(await screen.findByTestId("wizard-body-discard-it"));
    expect(screen.queryByTestId("wizard-words")).toBeNull();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    expect(screen.getByTestId("wizard-words")).toHaveValue("");
  });

  it("switches silently while the body is empty", async () => {
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.click(screen.getByTestId("wizard-to-media"));
    expect(screen.queryByTestId("wizard-body-discard")).toBeNull();
    expect(screen.queryByTestId("wizard-words")).toBeNull();
  });
});

// ComposeDraft / ComposeDraftDiscard: the kept draft's card wears the task ring,
// and a tap on the dimmed roll raises the discard ask instead of finding nothing.
describe("the kept draft", () => {
  const held: WizardState = { ...emptyWizard(), mode: "words", words: "an unfinished thought", title: "Salt maps" };

  it("wears the brand's task ring", async () => {
    render(fakeDrafts(held));
    expect((await screen.findByTestId("wizard-draft-card")).className).toContain("cg-task-ring");
  });

  it("shields the dimmed roll with one control named for what comes first", async () => {
    render(fakeDrafts(held));
    await screen.findByTestId("wizard-draft-card");
    const shield = screen.getByRole("button", { name: "Answer your draft before starting a new post" });
    fireEvent.click(shield);
    const ask = await screen.findByTestId("wizard-draft-discard-ask");
    expect(within(ask).getByText("Discard your draft?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wizard-draft-keep"));
    expect(screen.queryByTestId("wizard-draft-discard-ask")).toBeNull();
    expect(screen.getByTestId("wizard-draft-card")).toBeInTheDocument();
  });

  it("discards from the ask and gives the pictures back", async () => {
    const drafts = fakeDrafts(held);
    render(drafts);
    await screen.findByTestId("wizard-draft-card");
    fireEvent.click(screen.getByTestId("wizard-draft-shield"));
    fireEvent.click(await screen.findByTestId("wizard-draft-discard-it"));
    await waitFor(() => expect(drafts.held()).toBeNull());
    expect(screen.queryByTestId("wizard-draft-shield")).toBeNull();
    expect(screen.getByTestId("wizard-pick-region")).not.toHaveAttribute("inert");
  });
});
});

// ComposeSealUploading: the commit stays enabled while the bytes go up; a
// press is HELD, nothing is prepared or signed before the last upload lands,
// and the signing then proceeds with no second press.
describe("a press held on the upload gate", () => {
  it("signs the moment the last upload lands, with no second press", async () => {
    let releaseUpload: () => void = () => {};
    const uploaded = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    let prepared = 0;
    server.use(
      gqlLink.mutation("UploadMedia", async () => {
        await uploaded;
        return HttpResponse.json({
          data: {
            uploadMedia: { __typename: "UploadMediaPayload", media: echoedMedia("m-held"), userErrors: [] },
          },
        });
      }),
      gqlLink.mutation("PreparePost", () => {
        prepared += 1;
        return HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: "post-held",
              writes: [
                { __typename: "PreparedWrite", id: "w1", family: "PUBLISH", canonicalProposal: "AA==", gcAfterEpochs: 3 },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    render();

    await pick(["one.jpg"]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    await screen.findByTestId(byNode("composeDetails.title.input"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));

    expect(await screen.findByTestId("wizard-seal-blocked")).toHaveTextContent(/^Uploading 0 of 1/);
    const commit = screen.getByTestId("wizard-sign");
    expect(commit).not.toBeDisabled();
    fireEvent.click(commit);
    // Held: nothing is prepared while the bytes are still moving.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(prepared).toBe(0);

    releaseUpload();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/post-held?published=1"));
    expect(prepared).toBe(1);
  });
});

// THE PICKERS IN THE WIZARD (TagPicker.md, ReferencePicker.md; ComposeDetails
// board: `+ Add a tag`, `+ Cite something`). Each opens in the details stage's
// place; a pick is the draft's at once, and Done returns to details.
describe("the details stage's pickers", () => {
  async function reachDetailsOnWords() {
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "words" } });
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next")));
    await screen.findByTestId(byNode("composeDetails.title.input"));
  }

  it("stages a named tag through the tag picker, and Done brings it back to details", async () => {
    server.use(
      gqlLink.query("TagNames", () =>
        HttpResponse.json({ data: { search: { __typename: "SearchConnection", edges: [] } } }),
      ),
    );
    await reachDetailsOnWords();
    fireEvent.click(screen.getByTestId(byNode("composeDetails.tags.add")));

    const field = await screen.findByRole("searchbox", { name: "Name a tag" });
    expect(screen.getByRole("heading", { name: "Add a tag" })).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "#Rust" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.getByTestId(byNode("tagPicker.staged.tag", "rust"))).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(byNode("tagPicker.done")));
    expect(await screen.findByTestId(byNode("composeDetails.tags.tag", "rust"))).toHaveTextContent("#rust");
  });

  it("keeps a pick when the picker is left by its arrow", async () => {
    server.use(
      gqlLink.query("TagNames", () =>
        HttpResponse.json({ data: { search: { __typename: "SearchConnection", edges: [] } } }),
      ),
    );
    await reachDetailsOnWords();
    fireEvent.click(screen.getByTestId(byNode("composeDetails.tags.add")));
    const field = await screen.findByRole("searchbox", { name: "Name a tag" });
    fireEvent.change(field, { target: { value: "salt" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Back to the post" }));
    expect(await screen.findByTestId(byNode("composeDetails.tags.tag", "salt"))).toBeInTheDocument();
  });

  it("stages a citation through the citation picker", async () => {
    server.use(
      gqlLink.query("ReferenceCandidates", () =>
        HttpResponse.json({
          data: {
            referenceCandidates: [
              {
                __typename: "ReferenceCandidate",
                targetId: "u-sal",
                target: {
                  __typename: "User",
                  id: "u-sal",
                  handle: "saltorres",
                  displayName: { __typename: "ModeratedText", value: "Sal Torres" },
                },
              },
            ],
          },
        }),
      ),
    );
    await reachDetailsOnWords();
    fireEvent.click(screen.getByTestId(byNode("composeDetails.references.add")));
    const field = await screen.findByRole("searchbox", { name: "Cite something" });
    fireEvent.change(field, { target: { value: "sal" } });
    fireEvent.click(await screen.findByTestId(byNode("referencePicker.result", "u-sal")));
    fireEvent.click(screen.getByTestId(byNode("referencePicker.done")));

    // ComposeDetails.md: a citation staged here starts at the pair +0.10 / +0.10.
    const row = await screen.findByTestId(byNode("composeDetails.references.stagedReference", "1"));
    expect(row).toHaveTextContent("@saltorres");
    expect(row).toHaveTextContent("+0.10 / +0.10");
  });
});

// THE ALREADY-PUBLISHED MARKER, WIRED (ComposeDetails.md: "WHEN media
// attaches GIVEN it matches media in a published post of the author ->
// composeDetails.mediaRow shows the already-published marker"; "WHEN tap the
// already-published marker -> the earliest matching post opens").
describe("the already-published marker", () => {
  const landed = (): WizardState => ({
    ...emptyWizard(),
    step: "details",
    mode: "media",
    assets: [
      {
        id: "a0",
        file: new Blob([new Uint8Array([1]) as BlobPart], { type: "image/webp" }),
        crop: { x: 0, y: 0, zoom: 1, area: null, areaPercent: null },
        altText: "",
        upload: {
          kind: "done",
          mediaId: "m-held",
          media: { digest: "d-held", uploadDigest: "d-held", mime: "image/webp" },
        },
        kind: "picture",
      },
    ],
  });

  function chronicle(...posts: readonly { id: string; createdAt: string; mediaId: string }[]) {
    server.use(
      gqlLink.query("OwnPublishedMedia", () =>
        HttpResponse.json({
          data: {
            records: {
              __typename: "RecordConnection",
              edges: posts.map((post) => ({
                __typename: "RecordEdge",
                node: {
                  __typename: "Record",
                  id: `r-${post.id}`,
                  target: {
                    __typename: "Post",
                    id: post.id,
                    createdAt: post.createdAt,
                    attachments: [{ __typename: "MediaAttachment", id: post.mediaId, digest: `d-${post.mediaId.slice(2)}` }],
                  },
                },
              })),
              pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
            },
          },
        }),
      ),
    );
  }

  it("names the earliest of the author's posts carrying the picture, and opens it", async () => {
    chronicle(
      { id: "p-new", createdAt: "2026-10-20T10:00:00Z", mediaId: "m-held" },
      { id: "p-old", createdAt: "2026-09-12T10:00:00Z", mediaId: "m-held" },
    );
    render(fakeDrafts(landed()));
    fireEvent.click(await screen.findByTestId("wizard-draft-continue"));

    const door = await screen.findByTestId("composeDetails.mediaRow.published");
    expect(door).toHaveTextContent(/^Already in your post from .*12.*\.$/);
    expect(screen.getByTestId(byNode("composeDetails.next"))).not.toBeDisabled();
    fireEvent.click(door);
    expect(push).toHaveBeenCalledWith("/posts/p-old");
  });

  it("draws nothing when no published post carries it", async () => {
    chronicle({ id: "p-other", createdAt: "2026-09-12T10:00:00Z", mediaId: "m-other" });
    render(fakeDrafts(landed()));
    fireEvent.click(await screen.findByTestId("wizard-draft-continue"));
    await screen.findByTestId(byNode("composeDetails.title.input"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByTestId("composeDetails.mediaRow.published")).toBeNull();
  });
});
