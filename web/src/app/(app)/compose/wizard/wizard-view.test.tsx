// The wizard as a reader drives it. `wizard.test.ts` proves the rules; this
// proves the screens obey them — and it leans on the branches that are easy to
// get wrong in a five-screen flow: the XOR, an upload that fails and is retried,
// a batch that expires, a browser with no key, and the draft that outlives all
// of it.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { fakeWriteSigner } from "@/test/registration";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { emptyWizard, type WizardState } from "@/lib/compose/wizard";
import type { ComposeDraftStore } from "@/lib/compose/draft-store";
import { ComposeWizard } from "./wizard-view";

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
  graphql.mutation("PreparePost", () =>
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
  return graphql.mutation("UploadMedia", () =>
    HttpResponse.json({
      data: {
        uploadMedia: {
          __typename: "UploadMediaPayload",
          media: {
            __typename: "MediaAttachment",
            id: ids[Math.min(next++, ids.length - 1)],
            url: "https://media.test/x.webp",
            altText: null,
            status: "NORMAL",
            options: { __typename: "MediaOptions", aspectRatio: "4:5" },
          },
          userErrors: [],
        },
      },
    }),
  );
};

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
}

function render(drafts = fakeDrafts(), keyed = true) {
  return renderWithProviders(
    <ComposeWizard store={fakeIdentityStore({ keyOnDevice: keyed })} drafts={drafts} />,
    { store: signedInStore(), writeSigner: fakeWriteSigner() },
  );
}

beforeEach(() => {
  installEncoder();
  searchParams = new URLSearchParams();
  push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the compose wizard", () => {
  it("publishes a words post without ever showing a crop screen", async () => {
    let variables: { input: { content: string | null; attachments: unknown } } | null = null;
    server.use(
      graphql.mutation("PreparePost", ({ variables: v }) => {
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
    fireEvent.click(screen.getByTestId("wizard-next"));

    // Straight to details: there is nothing to crop.
    expect(await screen.findByTestId("wizard-title")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wizard-next"));

    fireEvent.click(await screen.findByTestId("wizard-sign"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/post-1?published=1"));
    expect(variables!.input.content).toBe("Three weekends at low tide.");
    // The XOR, on the wire: a words post carries no gallery at all.
    expect(variables!.input.attachments).toBeNull();
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
    fireEvent.click(screen.getByTestId("wizard-next"));

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
    fireEvent.click(screen.getByTestId("wizard-next"));

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

  it("refuses to leave the pick screen with no body", async () => {
    render();
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.click(screen.getByTestId("wizard-next"));
    expect(screen.getByTestId("wizard-body-error")).toHaveTextContent("The post needs a body");
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
        }[];
      };
    } | null = null;
    server.use(
      uploadOk(["m-a", "m-b"]),
      graphql.mutation("PreparePost", ({ variables: v }) => {
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
    fireEvent.click(await screen.findByTestId("wizard-next"));

    // The crop screen carries no keyboard: a description is written over the
    // details step, never here (design/readme.md §"The media slice").
    expect(screen.queryByTestId("wizard-alt-text")).toBeNull();
    fireEvent.click(screen.getByTestId("wizard-next"));

    // Uploads run from here; the seal opens only once they are done.
    expect(await screen.findByTestId("wizard-title")).toBeInTheDocument();

    // The describe counter is the way in, and it opens the sheet on a picture.
    fireEvent.click(screen.getByTestId("wizard-describe-counter"));
    fireEvent.change(await screen.findByTestId("wizard-describe-sheet-field"), {
      target: { value: "paper against the salt crust" },
    });
    fireEvent.click(screen.getByTestId("wizard-describe-sheet-done"));
    fireEvent.click(screen.getByTestId("wizard-next"));
    await waitFor(() => expect(screen.getByTestId("wizard-sign")).not.toBeDisabled());

    fireEvent.click(screen.getByTestId("wizard-sign"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/post-1?published=1"));

    // The description rides the attachment, not the upload: it was typed
    // long after the bytes were already stored, and it still reaches the
    // record that the signature covers.
    expect(variables!.input.attachments).toEqual([
      { mediaId: "m-a", displayOrder: 0, isCover: true, altText: "paper against the salt crust" },
      { mediaId: "m-b", displayOrder: 1, isCover: false, altText: null },
    ]);
  });

  it("holds the seal shut while a picture is unresolved, and retries just that one", async () => {
    let attempts = 0;
    server.use(
      graphql.mutation("UploadMedia", () => {
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
              media: {
                __typename: "MediaAttachment",
                id: "m-retried",
                url: "https://media.test/x.webp",
                altText: null,
                status: "NORMAL",
                options: { __typename: "MediaOptions", aspectRatio: "4:5" },
              },
              userErrors: [],
            },
          },
        });
      }),
    );
    render();

    await pick(["one.jpg"]);
    fireEvent.click(await screen.findByTestId("wizard-next"));
    fireEvent.click(await screen.findByTestId("wizard-next"));

    // The server's own words, on the details screen, with the retry beside them.
    expect(await screen.findByText(/too many uploads/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wizard-next"));
    expect(await screen.findByTestId("wizard-seal-blocked")).toHaveTextContent(
      "One picture didn't upload",
    );
    expect(screen.getByTestId("wizard-sign")).toBeDisabled();

    // Back to the details screen to retry the one that failed.
    fireEvent.click(screen.getByTestId("wizard-back"));
    fireEvent.click(await screen.findByTestId("wizard-upload-error-retry"));
    fireEvent.click(screen.getByTestId("wizard-next"));
    await waitFor(() => expect(screen.getByTestId("wizard-sign")).not.toBeDisabled());
    expect(attempts).toBe(2);
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
    fireEvent.click(screen.getByTestId("wizard-next"));
    fireEvent.click(await screen.findByTestId("wizard-next"));
    fireEvent.click(await screen.findByTestId("wizard-sign"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed?compose=expired"));
    // The notice's promise, made true here rather than in its own copy.
    expect(drafts.held()?.words).toBe("words");
  });

  it("offers a keyless browser the restore route instead of a sign button", async () => {
    render(fakeDrafts(), false);
    fireEvent.click(await screen.findByTestId("wizard-to-words"));
    fireEvent.change(screen.getByTestId("wizard-words"), { target: { value: "words" } });
    fireEvent.click(screen.getByTestId("wizard-next"));
    fireEvent.click(await screen.findByTestId("wizard-next"));

    expect(await screen.findByTestId("wizard-key-absent")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-sign")).not.toBeInTheDocument();
    expect(screen.getByTestId("wizard-keep-draft")).toBeInTheDocument();
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

  it("restores a held draft on the step it was left on", async () => {
    const held: WizardState = {
      ...emptyWizard(),
      mode: "words",
      words: "an unfinished thought",
      step: "details",
    };
    render(fakeDrafts(held));

    fireEvent.click(await screen.findByTestId("wizard-draft-continue"));
    expect(await screen.findByTestId("wizard-title")).toBeInTheDocument();
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
    fireEvent.click(screen.getByTestId("header-back"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    expect(drafts.held()?.words).toBe("come back to me");
  });
});
