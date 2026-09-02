// The reply wizard as a reader drives it. `reply-wizard.test.ts` proves the
// rules; this proves the screens obey them — and it holds the board's own
// promises: two stages, a pinned target, a seal that names every act with its
// price, a pad that stages nothing until Set, and a leave that discards.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { fakeWriteSigner } from "@/test/registration";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import type { ReplyTarget } from "@/lib/compose/reply-wizard";
import { ReplyWizard } from "./reply-wizard-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const server = startMswServer();

const POST_TARGET: ReplyTarget = {
  id: "p1",
  kind: "post",
  label: "The long way home",
  authorHandle: "ada",
  authorName: "Ada Okonkwo",
  avatarUrl: null,
  snippet: "The light does something at the third headland…",
};

const COMMENT_TARGET: ReplyTarget = {
  id: "c1",
  kind: "comment",
  label: "Tobias Lindqvist",
  authorHandle: "tobias",
  authorName: "Tobias Lindqvist",
  avatarUrl: null,
  snippet: "That stretch after the second bend…",
};

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
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
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:preview",
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
}

const prepareOk = (node = "comment-9", writes = 1) =>
  graphql.mutation("PrepareComment", () =>
    HttpResponse.json({
      data: {
        prepareComment: {
          __typename: "PrepareContentPayload",
          node,
          writes: Array.from({ length: writes }, (_, index) => ({
            __typename: "PreparedWrite",
            id: `w${index + 1}`,
            family: "REVIEW",
            canonicalProposal: "AA==",
            gcAfterEpochs: 3,
          })),
          userErrors: [],
        },
      },
    }),
  );

const uploadOk = (id = "m1") =>
  graphql.mutation("UploadMedia", () =>
    HttpResponse.json({
      data: {
        uploadMedia: {
          __typename: "UploadMediaPayload",
          media: {
            __typename: "MediaAttachment",
            id,
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

function draw({
  target = POST_TARGET,
  keyed = true,
  onLeave = vi.fn(),
  onSigned = vi.fn(),
}: {
  target?: ReplyTarget;
  keyed?: boolean;
  onLeave?: () => void;
  onSigned?: (node: string) => void;
} = {}) {
  renderWithProviders(
    <ReplyWizard
      target={target}
      store={fakeIdentityStore({ keyOnDevice: keyed })}
      onLeave={onLeave}
      onSigned={onSigned}
    />,
    { store: signedInStore(), writeSigner: fakeWriteSigner() },
  );
  return { onLeave, onSigned };
}

function write(words: string) {
  fireEvent.change(screen.getByTestId("reply-words"), { target: { value: words } });
}

async function pick(names: string[]) {
  const input = await screen.findByTestId("reply-media-input");
  const files = names.map(
    (name) => new File([new Uint8Array([1, 2, 3]) as BlobPart], name, { type: "image/jpeg" }),
  );
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

/** Words in, Next pressed — the seal, which is where most of this lives. */
async function toSeal(words = "The third headland light is real.") {
  write(words);
  fireEvent.click(screen.getByTestId("reply-next"));
  return screen.findByTestId("reply-seal");
}

beforeEach(() => {
  installEncoder();
  push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the reply wizard", () => {
  describe("the composer", () => {
    it("pins the post when the thread's own door was used", () => {
      draw({ target: POST_TARGET });
      expect(screen.getByTestId("reply-target")).toHaveTextContent("The long way home — @ada");
      expect(screen.getByTestId("reply-target")).toHaveTextContent(
        "The light does something at the third headland",
      );
    });

    it("pins the comment when Reply was pressed on one", () => {
      draw({ target: COMMENT_TARGET });
      expect(screen.getByTestId("reply-target")).toHaveTextContent(
        "Tobias Lindqvist — @tobias",
      );
    });

    it("names what the words answer, for a reader who cannot see the chip", () => {
      draw();
      expect(screen.getByTestId("reply-words")).toHaveAttribute(
        "aria-label",
        "Your reply to The long way home",
      );
    });

    it("holds Next until there are words — the pictures are the optional half", async () => {
      draw();
      fireEvent.click(screen.getByTestId("reply-next"));
      expect(screen.queryByTestId("reply-seal")).not.toBeInTheDocument();
      write("Something worth saying.");
      fireEvent.click(screen.getByTestId("reply-next"));
      expect(await screen.findByTestId("reply-seal")).toBeInTheDocument();
    });

    it("never shows a pick screen — Add opens the browser's own dialog", async () => {
      draw();
      // The input IS the affordance: there is no grid, and no stage between.
      expect(await screen.findByTestId("reply-media-input")).toHaveAttribute("type", "file");
      expect(screen.getByTestId("reply-add-media")).toHaveTextContent(
        "+ Add pictures or a video",
      );
    });

    it("counts the tray against the comment's own cap of four", async () => {
      server.use(uploadOk());
      draw();
      await pick(["a.jpg", "b.jpg"]);
      await waitFor(() =>
        expect(screen.getByTestId("reply-add-media")).toHaveTextContent(
          "+ Add pictures · 2 of 4",
        ),
      );
    });

    it("takes at most four, however many are chosen", async () => {
      server.use(uploadOk());
      draw();
      await pick(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"]);
      await waitFor(() =>
        expect(screen.getByTestId("reply-add-media")).toHaveTextContent(
          "+ Add pictures · 4 of 4",
        ),
      );
    });

    it("says the composer takes a drop, which is the web board's one addition", () => {
      draw();
      expect(screen.getByTestId("reply-compose")).toHaveTextContent(
        "…or drop pictures or a video here.",
      );
    });

    it("offers the describe counter once there is something to describe", async () => {
      server.use(uploadOk());
      draw();
      expect(screen.queryByTestId("reply-describe-counter")).not.toBeInTheDocument();
      await pick(["a.jpg"]);
      await waitFor(() =>
        expect(screen.getByTestId("reply-describe-counter")).toBeInTheDocument(),
      );
    });
  });

  describe("the seal", () => {
    it("says what is answered and how long the answer is", async () => {
      draw();
      await toSeal("Four");
      expect(screen.getByTestId("reply-seal")).toHaveTextContent(
        'Reply to "The long way home" — 4 characters.',
      );
    });

    it("names the one act the comment is", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-act-comment")).toHaveTextContent(
        "Reply to @ada's post",
      );
      expect(screen.getByTestId("reply-signed-actions")).toHaveTextContent("1 signed action");
    });

    it("names the comment it answers when the reply was pre-targeted", async () => {
      draw({ target: COMMENT_TARGET });
      await toSeal();
      expect(screen.getByTestId("reply-act-comment")).toHaveTextContent(
        "Reply to @tobias's comment",
      );
    });

    it("carries the stance the board shows before anyone opens the pad", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-stance-value")).toHaveTextContent("+0.10 / +0.10");
    });

    it("carries the license row, on the default", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-seal")).toHaveTextContent("Public domain — your default");
      expect(screen.getByTestId("reply-open-license")).toBeInTheDocument();
    });

    // THE APPROVED DEVIATION (jakob 2026-09-01). The board draws a "Mark
    // (sensitive)" row; a sensitive-marked comment has no veiled read state
    // yet, so the row is held back rather than promising a veil nobody gets.
    it("ships no sensitive row, and offers no way to mark one", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-seal")).not.toHaveTextContent("Sensitive");
      expect(screen.queryByTestId("reply-open-sensitive")).not.toBeInTheDocument();
    });

    it("offers the topic and citation rows the board draws, with their price", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-open-topics")).toHaveTextContent("+ Add a topic");
      expect(screen.getByTestId("reply-open-references")).toHaveTextContent("+ Cite something");
      expect(screen.getByTestId("reply-seal")).toHaveTextContent("1 more action");
    });

    it("steps back to the words, which are still there", async () => {
      draw();
      await toSeal("Still here.");
      fireEvent.click(screen.getByTestId("reply-back"));
      expect(await screen.findByTestId("reply-words")).toHaveValue("Still here.");
    });
  });

  describe("the pad", () => {
    it("stages nothing when it is cancelled", async () => {
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-stance"));
      fireEvent.keyDown(await screen.findByTestId("reply-stance-pad-field"), {
        key: "ArrowRight",
        shiftKey: true,
      });
      fireEvent.click(screen.getByTestId("reply-stance-cancel"));
      expect(screen.getByTestId("reply-stance-value")).toHaveTextContent("+0.10 / +0.10");
    });

    it("moves the seal's stance only once Set is pressed", async () => {
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-stance"));
      fireEvent.keyDown(await screen.findByTestId("reply-stance-pad-field"), {
        key: "ArrowRight",
        shiftKey: true,
      });
      fireEvent.click(screen.getByTestId("reply-stance-set"));
      expect(screen.getByTestId("reply-stance-value")).toHaveTextContent("+0.30 / +0.10");
    });
  });

  describe("signing", () => {
    it("sends the words, the target and the stance the seal shows", async () => {
      let variables: { input: Record<string, unknown> } | null = null;
      server.use(
        graphql.mutation("PrepareComment", ({ variables: v }) => {
          variables = v as never;
          return HttpResponse.json({
            data: {
              prepareComment: {
                __typename: "PrepareContentPayload",
                node: "comment-9",
                writes: [
                  {
                    __typename: "PreparedWrite",
                    id: "w1",
                    family: "REVIEW",
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
      const { onSigned } = draw({ target: COMMENT_TARGET });
      await toSeal("Answering you.");
      fireEvent.click(screen.getByTestId("reply-sign"));

      await waitFor(() => expect(onSigned).toHaveBeenCalledWith("comment-9"));
      expect(variables!.input.target).toBe("c1");
      expect(variables!.input.content).toBe("Answering you.");
      // The seal's Adjust writes a genesis Review's own pair, so both travel.
      expect(variables!.input.pDirected).toBe(0.1);
      expect(variables!.input.pInterest).toBe(0.1);
      // Words alone carry no gallery at all.
      expect(variables!.input.attachments).toBeNull();
    });

    it("signs the whole returned batch, not only its first write", async () => {
      server.use(prepareOk("comment-9", 3));
      const signer = fakeWriteSigner();
      renderWithProviders(
        <ReplyWizard
          target={POST_TARGET}
          store={fakeIdentityStore({ keyOnDevice: true })}
          onLeave={vi.fn()}
          onSigned={vi.fn()}
        />,
        { store: signedInStore(), writeSigner: signer },
      );
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-sign"));
      await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(3));
    });

    it("sends the pictures once they have landed", async () => {
      let variables: { input: Record<string, unknown> } | null = null;
      server.use(
        uploadOk("m1"),
        graphql.mutation("PrepareComment", ({ variables: v }) => {
          variables = v as never;
          return HttpResponse.json({
            data: {
              prepareComment: {
                __typename: "PrepareContentPayload",
                node: "comment-9",
                writes: [
                  {
                    __typename: "PreparedWrite",
                    id: "w1",
                    family: "REVIEW",
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
      draw();
      write("With a picture.");
      await pick(["a.jpg"]);
      fireEvent.click(screen.getByTestId("reply-next"));
      await screen.findByTestId("reply-seal");
      await waitFor(() => expect(screen.getByTestId("reply-sign")).not.toBeDisabled());
      fireEvent.click(screen.getByTestId("reply-sign"));
      await waitFor(() => expect(variables).not.toBeNull());
      expect(variables!.input.attachments).toEqual([
        { mediaId: "m1", displayOrder: 0, isCover: true, altText: null },
      ]);
    });

    it("holds the seal while a picture is still on its way, and says so", async () => {
      // No upload handler that ever resolves: the gate is what is under test.
      server.use(
        graphql.mutation("UploadMedia", async () => {
          await new Promise(() => {});
          return HttpResponse.json({});
        }),
      );
      draw();
      write("With a picture.");
      await pick(["a.jpg"]);
      fireEvent.click(screen.getByTestId("reply-next"));
      await screen.findByTestId("reply-seal");
      expect(screen.getByTestId("reply-sign")).toBeDisabled();
      expect(screen.getByTestId("reply-seal-blocked")).toBeInTheDocument();
    });

    it("routes a refused topic onto its own chip and reopens the sheet", async () => {
      server.use(
        graphql.mutation("PrepareComment", () =>
          HttpResponse.json({
            data: {
              prepareComment: {
                __typename: "PrepareContentPayload",
                node: null,
                writes: null,
                userErrors: [
                  {
                    __typename: "UserError",
                    message: "that topic is reserved",
                    code: "INVALID",
                    field: ["tags", "0", "name"],
                  },
                ],
              },
            },
          }),
        ),
      );
      const { onSigned } = draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-sign"));
      await waitFor(() =>
        expect(screen.getByTestId("reply-topics-sheet")).toBeInTheDocument(),
      );
      expect(onSigned).not.toHaveBeenCalled();
    });

    it("surfaces a submit that never reached the server", async () => {
      server.use(graphql.mutation("PrepareComment", () => HttpResponse.error()));
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-sign"));
      expect(await screen.findByTestId("reply-transport-error")).toBeInTheDocument();
    });

    it("tells a keyless browser to restore rather than offering a dead button", async () => {
      draw({ keyed: false });
      await toSeal();
      await waitFor(() => expect(screen.getByTestId("reply-key-absent")).toBeInTheDocument());
      expect(screen.queryByTestId("reply-sign")).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("reply-restore-key"));
      expect(push).toHaveBeenCalledWith("/restore");
    });
  });

  describe("leaving", () => {
    // NO COMMENT DRAFTS (jakob 2026-09-01): the X discards, so the label must
    // not promise the post wizard's kept draft.
    it("says the comment is discarded rather than kept", () => {
      draw();
      expect(screen.getByTestId("header-leave")).toHaveAttribute(
        "aria-label",
        "Leave — this comment is discarded",
      );
    });

    it("asks before discarding from the seal, where words certainly exist", async () => {
      // Every reply leave edge routes through DiscardConfirm when something is
      // written — the seal is reached only with words, so it always asks.
      const { onLeave } = draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("header-leave"));
      expect(onLeave).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId("reply-discard-confirm-discard"));
      expect(onLeave).toHaveBeenCalled();
    });

    it("leaves an empty composer at once, asking nothing", () => {
      // "empty — leaves at once". A confirmation over nothing is what trains an
      // author to dismiss the dialog unread.
      const { onLeave } = draw();
      fireEvent.click(screen.getByTestId("header-leave"));
      expect(onLeave).toHaveBeenCalled();
    });

    it("keeps writing when the confirm is declined, losing nothing", () => {
      const { onLeave } = draw();
      write("half a thought");
      fireEvent.click(screen.getByTestId("header-leave"));

      fireEvent.click(screen.getByTestId("reply-discard-confirm-keep"));
      expect(onLeave).not.toHaveBeenCalled();
      expect(screen.getByTestId("reply-words")).toHaveValue("half a thought");
    });

    it("takes the arrow on the first stage back to the thread, not out of the app", () => {
      const { onLeave } = draw();
      fireEvent.click(screen.getByTestId("header-back"));
      expect(onLeave).toHaveBeenCalled();
    });

    it("keeps nothing once discarded: a fresh wizard opens empty", async () => {
      const { onLeave } = draw();
      write("half a thought");
      fireEvent.click(screen.getByTestId("header-leave"));
      fireEvent.click(screen.getByTestId("reply-discard-confirm-discard"));
      expect(onLeave).toHaveBeenCalled();
      // Nothing persisted it, so the next open starts from nothing — which is
      // exactly why the confirm has to be asked before this point.
      draw();
      await waitFor(() => expect(screen.getAllByTestId("reply-words")[1]).toHaveValue(""));
    });
  });
});
