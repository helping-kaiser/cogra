// The reply wizard as a reader drives it. `reply-wizard.test.ts` proves the
// rules; this proves the screens obey them — and it holds the board's own
// promises: two stages, a pinned target, a seal that names every act with its
// price, a pad that stages nothing until Set, and a leave that discards.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { fakeWriteSigner } from "@/test/registration";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { byNode } from "@/test/data-node";
import { echoedMedia } from "@/test/media-echo";
import type { ReplyTarget } from "@/lib/compose/reply-wizard";
import { raisedLayersForTests } from "@/lib/ui2/covering-layer";
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
  gqlLink.mutation("PrepareComment", () =>
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
  gqlLink.mutation("UploadMedia", () =>
    HttpResponse.json({
      data: {
        uploadMedia: {
          __typename: "UploadMediaPayload",
          media: echoedMedia(id),
          userErrors: [],
        },
      },
    }),
  );

// The device's upload digest, pinned so the server above can echo it
// (test/media-echo.ts).
vi.mock("@/lib/api/media-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/media-api")>()),
  uploadDigestOf: async () => "ee".repeat(32),
}));

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


/** The tag index, answering the names in use (`TagNames`); none by default. */
function tagNames(...names: readonly string[]) {
  return gqlLink.query("TagNames", () =>
    HttpResponse.json({
      data: {
        search: {
          __typename: "SearchConnection",
          edges: names.map((name, i) => ({
            __typename: "SearchEdge",
            node: { __typename: "Hashtag", id: `h${i}`, name: { __typename: "ModeratedText", value: name } },
          })),
        },
      },
    }),
  );
}

/** From the seal: `+ Add a tag`, the typed name staged by its first row, Done. */
function stageTag(name: string) {
  fireEvent.click(screen.getByTestId("reply-open-tags"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Name a tag" }), { target: { value: name } });
  fireEvent.click(screen.getByTestId(byNode("tagPicker.tag", name)));
  fireEvent.click(screen.getByTestId(byNode("tagPicker.done")));
}

/** Words in, Next pressed — the seal, which is where most of this lives. */
async function toSeal(words = "The third headland light is real.") {
  write(words);
  fireEvent.click(screen.getByTestId("reply-next"));
  return screen.findByTestId("reply-seal");
}

beforeEach(async () => {
  installEncoder();
  push.mockClear();
  // An open wizard rides history entries, and jsdom's history outlives a
  // test: the last test's traversals are let finish, and its marks cleared.
  await new Promise((resolve) => setTimeout(resolve, 20));
  window.history.replaceState(null, "");
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

    // HT-6. `TextField.prompt.md` puts every composer textarea on the
    // extra-small rung with a 1px outline AT REST; a field with no edge until
    // it is focused does not read as somewhere to write. The height follows
    // Android's `ReplyComposeStep.kt`: the words fill the column when they are
    // the only thing in it.
    it("draws the words in a real field — outlined at rest, and tall", () => {
      draw();
      const words = screen.getByTestId("reply-words");
      expect(words.className).toContain("border-outline");
      expect(words.className).toContain("rounded-extra-small");
      expect(words.className).not.toContain("border-0");
      expect(words.className).toContain("flex-1");
    });

    // The drawn height is the WHOLE column's slack, and a second growing child
    // beside the words halves it. Android has the same rule as a branch
    // (`ReplyComposeStep.kt:141` — the spacer is drawn only when the words do
    // not fill), so the assertion is that the words are the only one growing.
    it("gives the words every pixel of the column's slack", () => {
      draw();
      const column = screen.getByTestId("reply-compose");
      const growing = Array.from(column.children).filter((child) =>
        child.className.split(/\s+/).includes("flex-1"),
      );
      expect(growing).toEqual([screen.getByTestId("reply-words")]);
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
      expect(screen.getByTestId("reply-seal-acts-total")).toHaveTextContent("1 thing, signed");
    });

    it("names the comment it answers when the reply was pre-targeted", async () => {
      draw({ target: COMMENT_TARGET });
      await toSeal("Four");
      // ReplySealComment.md:3 — the read-back names the comment by its author's handle.
      expect(screen.getByTestId("reply-seal-summary")).toHaveTextContent("Reply to @tobias — 4 characters.");
      expect(screen.getByTestId("reply-act-comment")).toHaveTextContent(
        "Reply to @tobias's comment",
      );
    });

    it("carries the stance the board shows before anyone opens the pad", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-stance-value")).toHaveTextContent("+0.10 / +0.10");
    });

    it("draws the stance's digits as the geek reading, in a cg-exact span (readme §13)", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-stance-value").querySelector(".cg-exact")).toHaveTextContent(
        "+0.10 / +0.10",
      );
    });

    it("carries the license row, on the default", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-seal")).toHaveTextContent(
        "Public domain — nobody owes you a name, and uses go unlogged.",
      );
      expect(screen.getByTestId("reply-seal")).not.toHaveTextContent("your default");
      expect(screen.getByTestId("reply-open-license")).toBeInTheDocument();
    });

    // CW-28's web twin: the license sheet draws the board's row anatomy,
    // not `LicenseChooser`'s settings-page fieldset — which put a second
    // "License" legend and a second note inside a sheet already titled and
    // noted. The post seal was corrected first; this is the same component.
    it("opens the license sheet with the boarded rows, not a second legend", async () => {
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-license"));
      expect(await screen.findByTestId("reply-license-rows")).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Credit" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Public record of use" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "License" })).not.toBeInTheDocument();
    });

    // The board's third term row, held back only while a marked comment had
    // no veil to promise. Design backlog item 25.4 built that on 2026-09-02.
    it("carries the mark row the board draws, unmarked to begin with", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-sensitive-value")).toHaveTextContent("Not marked");
      expect(screen.getByTestId("reply-open-sensitive")).toHaveTextContent("Mark");
    });

    it("marks the comment through the same sheet every seal opens", async () => {
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-sensitive"));
      const sheet = await screen.findByTestId("reply-sensitive-sheet");
      expect(sheet).toBeInTheDocument();
      // `Mark` opens it marked; Done carries the mark to the row.
      expect(screen.getByTestId("reply-sensitive-switch")).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByTestId("reply-sensitive-done"));
      await waitFor(() =>
        expect(screen.getByTestId("reply-sensitive-value")).toHaveTextContent("Marked"),
      );
      expect(screen.getByTestId("reply-open-sensitive")).toHaveTextContent("Change");
    });

    it("offers the tag and citation rows the board draws, with their price (ReplySeal.md:5)", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("reply-open-tags")).toHaveTextContent("+ Add a tag");
      expect(screen.getByTestId("reply-open-references")).toHaveTextContent("+ Cite something");
      // The offer's price is the board's bare "1 more", not a sentence.
      expect(screen.getByTestId("reply-seal")).toHaveTextContent("1 more");
      expect(screen.getByTestId("reply-seal")).not.toHaveTextContent("1 more action");
    });

    it("steps back to the words, which are still there", async () => {
      draw();
      await toSeal("Still here.");
      fireEvent.click(screen.getByTestId("reply-back"));
      expect(await screen.findByTestId("reply-words")).toHaveValue("Still here.");
    });
  });

  // THE REPLY COMPOSER OPENS THE PICKERS (round 27, seam 253; TagPicker.md,
  // ReferencePicker.md): in the composer's place, inside the reply's dialog.
  describe("the pickers", () => {
    it("+ Add a tag opens the tag picker in place, its arrow Back to the comment", async () => {
      server.use(tagNames());
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-tags"));
      const picker = screen.getByTestId("reply-picker");
      expect(within(picker).getByRole("searchbox", { name: "Name a tag" })).toBeInTheDocument();
      expect(within(picker).getByRole("button", { name: "Back to the comment" })).toBeInTheDocument();
      // No inline finder, and the seal is not standing under it.
      expect(screen.queryByTestId("reply-seal")).toBeNull();
      expect(screen.queryByTestId("reply-tag-input")).toBeNull();
    });

    it("a pick lands in the reply at once, and Done gives the seal back with it staged", async () => {
      server.use(tagNames());
      draw();
      await toSeal();
      stageTag("saltmaps");
      expect(await screen.findByTestId("reply-seal")).toBeInTheDocument();
      expect(screen.getByTestId("reply-seal-tags")).toHaveTextContent("#saltmaps");
      expect(screen.getByTestId("reply-seal-acts-total")).toHaveTextContent("2 things, signed together");
      // + Add a tag stays under what has been added.
      expect(screen.getByTestId("reply-open-tags")).toBeInTheDocument();
    });

    it("the picker's arrow is Done's leave: the seal comes back with every pick kept", async () => {
      server.use(tagNames());
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-tags"));
      fireEvent.change(screen.getByRole("searchbox", { name: "Name a tag" }), { target: { value: "tidepools" } });
      fireEvent.click(screen.getByTestId(byNode("tagPicker.tag", "tidepools")));
      fireEvent.click(screen.getByRole("button", { name: "Back to the comment" }));
      expect(await screen.findByTestId("reply-seal")).toBeInTheDocument();
      expect(screen.getByTestId("reply-seal-tags")).toHaveTextContent("#tidepools");
    });

    it("TagPicker.md:29 the cap reads Up to 10 tags per comment. from the reply's composer", async () => {
      server.use(tagNames());
      draw();
      await toSeal();
      for (let i = 0; i < 10; i += 1) stageTag(`tag${i}`);
      fireEvent.click(screen.getByTestId("reply-open-tags"));
      expect(screen.getByTestId(byNode("tagPicker.cap"))).toHaveTextContent("Up to 10 tags per comment.");
    });

    it("+ Cite something opens the citation picker in place, its arrow Back to the comment", async () => {
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-references"));
      const picker = screen.getByTestId("reply-picker");
      expect(within(picker).getByTestId(byNode("referencePicker.searchField"))).toBeInTheDocument();
      expect(within(picker).getByRole("button", { name: "Back to the comment" })).toBeInTheDocument();
      expect(screen.queryByTestId("reply-reference-input")).toBeNull();
    });
  });

  describe("the pad", () => {
    // CR-18: the pad PARKS over the page, as android's already does and as
    // `ReplyPadBody` draws it — not in the drawer host, which would wrap a
    // control that has its own chrome in a second one.
    it("parks as its own panel rather than riding a bottom sheet", async () => {
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-stance"));
      const pad = await screen.findByTestId("reply-stance-pad-panel");
      expect(pad.tagName).toBe("DIALOG");
      expect(pad.className).toContain("mt-auto");
      expect(pad.className).not.toContain("rounded-t-extra-large");
      expect(screen.queryByTestId("reply-stance-sheet")).not.toBeInTheDocument();
    });

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
        gqlLink.mutation("PrepareComment", ({ variables: v }) => {
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
        gqlLink.mutation("PrepareComment", ({ variables: v }) => {
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
        {
          mediaId: "m1",
          displayOrder: 0,
          isCover: true,
          altText: null,
          coverMediaId: null,
          coverTaken: null,
        },
      ]);
    });

    // ReplySealUploading.md:3,7 — the line stands above the commit, and the
    // commit stays enabled through the gate.
    it("says the seal waits while a picture is still on its way, Sign comment still enabled", async () => {
      // No upload handler that ever resolves: the gate is what is under test.
      server.use(
        gqlLink.mutation("UploadMedia", async () => {
          await new Promise(() => {});
          return HttpResponse.json({});
        }),
      );
      draw();
      write("With a picture.");
      await pick(["a.jpg"]);
      fireEvent.click(screen.getByTestId("reply-next"));
      await screen.findByTestId("reply-seal");
      expect(screen.getByTestId("reply-seal-blocked")).toHaveTextContent(
        "Uploading 0 of 1 — signing waits for the picture.",
      );
      expect(screen.getByTestId("reply-sign")).not.toBeDisabled();
    });

    it("says a refused tag on its own row of the acts card, with Remove it", async () => {
      server.use(
        tagNames(),
        gqlLink.mutation("PrepareComment", () =>
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
      stageTag("reserved");
      fireEvent.click(screen.getByTestId("reply-sign"));
      const fault = await screen.findByTestId("reply-seal-tags-fault");
      expect(within(fault).getByRole("button", { name: "Remove #reserved" })).toBeInTheDocument();
      expect(screen.getByTestId("reply-refused")).toBeInTheDocument();
      expect(onSigned).not.toHaveBeenCalled();
      // Removing it retires the refusal said against it.
      fireEvent.click(within(fault).getByRole("button", { name: "Remove #reserved" }));
      expect(screen.queryByTestId("reply-seal-tags-fault")).toBeNull();
      expect(screen.queryByTestId("reply-seal-tags")).toBeNull();
    });

    // ReplySeal.md:19 — the fault line and Retry IN THE FOOT, in Sign
    // comment's place; Retry is the same signing, asked again.
    it("surfaces a submit that never reached the server in the foot, and Retry asks again", async () => {
      server.use(gqlLink.mutation("PrepareComment", () => HttpResponse.error()));
      const { onSigned } = draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-sign"));
      const line = await screen.findByTestId("reply-transport-error");
      expect(line).toHaveTextContent("That didn't send. Try again.");
      expect(within(screen.getByTestId("reply-seal")).getByTestId("reply-transport-error")).toBe(line);
      expect(screen.queryByTestId("reply-sign")).toBeNull();
      server.use(prepareOk("comment-9"));
      fireEvent.click(screen.getByTestId("reply-retry"));
      await waitFor(() => expect(onSigned).toHaveBeenCalledWith("comment-9"));
    });

    it("SealSigning.md: going a stage back and returning shows the plain commit again", async () => {
      server.use(gqlLink.mutation("PrepareComment", () => HttpResponse.error()));
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-sign"));
      await screen.findByTestId("reply-transport-error");
      fireEvent.click(screen.getByTestId("reply-back"));
      fireEvent.click(await screen.findByTestId("reply-next"));
      await screen.findByTestId("reply-seal");
      expect(screen.queryByTestId("reply-transport-error")).toBeNull();
      expect(screen.getByTestId("reply-sign")).toHaveTextContent("Sign comment");
    });

    it("ReplySeal.md:21 the write rule's notice says the reply is still here, its ? the reply's clause, Not now gives the seal back", async () => {
      server.use(
        gqlLink.mutation("PrepareComment", () =>
          HttpResponse.json({
            data: {
              prepareComment: {
                __typename: "PrepareContentPayload",
                node: null,
                writes: null,
                userErrors: [{ __typename: "UserError", message: "no", code: "WRITE_RULE_FAILED", field: null }],
              },
            },
          }),
        ),
      );
      const { onSigned } = draw();
      await toSeal("Still here.");
      fireEvent.click(screen.getByTestId("reply-sign"));
      const notice = await screen.findByTestId("reply-write-rule");
      expect(notice).toHaveTextContent("Nothing was signed or spent — your reply is still here.");
      expect(screen.queryByTestId("reply-retry")).toBeNull();
      fireEvent.click(screen.getByTestId("reply-write-rule-help"));
      expect(await screen.findByTestId("reply-help-dialog")).toHaveTextContent(
        "Nothing was signed or spent, and your reply is still here. Try again in a little while.",
      );
      fireEvent.click(screen.getByTestId("reply-not-now"));
      expect(screen.queryByTestId("reply-write-rule")).toBeNull();
      expect(screen.getByTestId("reply-sign")).toHaveTextContent("Sign comment");
      expect(onSigned).not.toHaveBeenCalled();
      // WriteRuleFailed.md:29 — the words still in its composer.
      fireEvent.click(screen.getByTestId("reply-back"));
      expect(await screen.findByTestId("reply-words")).toHaveValue("Still here.");
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

  // THE HELD PRESS (ReplySealUploading.md, ReplySealUploadFailed.md:15-19):
  // the reply's own gate, driven through the wizard with the uploads latched.
  describe("signing while the uploads run", () => {
    function latchedUploads() {
      const latches: { release: (outcome: "land" | "fail") => void }[] = [];
      let next = 0;
      server.use(
        gqlLink.mutation("UploadMedia", async () => {
          const outcome = await new Promise<"land" | "fail">((resolve) => latches.push({ release: resolve }));
          if (outcome === "fail") return HttpResponse.error();
          return HttpResponse.json({
            data: {
              uploadMedia: { __typename: "UploadMediaPayload", media: echoedMedia(`up-${next++}`), userErrors: [] },
            },
          });
        }),
      );
      return {
        async answer(outcome: "land" | "fail" = "land") {
          await waitFor(() => expect(latches.length).toBeGreaterThan(0));
          latches.shift()!.release(outcome);
        },
      };
    }

    function preparedCount() {
      const calls = { count: 0 };
      server.use(
        gqlLink.mutation("PrepareComment", () => {
          calls.count += 1;
          return HttpResponse.json({
            data: {
              prepareComment: {
                __typename: "PrepareContentPayload",
                node: "comment-9",
                writes: [
                  { __typename: "PreparedWrite", id: "w1", family: "REVIEW", canonicalProposal: "AA==", gcAfterEpochs: 3 },
                ],
                userErrors: [],
              },
            },
          });
        }),
      );
      return calls;
    }

    async function toGatedSeal() {
      write("With a picture.");
      await pick(["a.jpg"]);
      fireEvent.click(screen.getByTestId("reply-next"));
      await screen.findByTestId("reply-seal");
    }

    it("ReplySealUploading.md:9,15 a press is held, signs nothing before the bytes land, then signs with no second press", async () => {
      const bytes = latchedUploads();
      const prepared = preparedCount();
      const { onSigned } = draw();
      await toGatedSeal();
      const sign = screen.getByTestId("reply-sign");
      fireEvent.click(sign);
      fireEvent.click(sign);
      expect(sign).not.toBeDisabled();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(prepared.count).toBe(0);
      await bytes.answer("land");
      await waitFor(() => expect(onSigned).toHaveBeenCalledWith("comment-9"));
      expect(prepared.count).toBe(1);
    });

    it("ReplySealUploading.md:11 past 200ms the held press reads Signing comment… and the header's arrow, Back and X refuse", async () => {
      latchedUploads();
      const { onLeave } = draw();
      await toGatedSeal();
      fireEvent.click(screen.getByTestId("reply-sign"));
      await waitFor(() => expect(screen.getByTestId("reply-sign")).toHaveTextContent("Signing comment…"), {
        timeout: 1000,
      });
      fireEvent.click(screen.getByTestId("header-leave"));
      fireEvent.click(screen.getByTestId("header-back"));
      fireEvent.click(screen.getByTestId("reply-back"));
      expect(screen.getByTestId("reply-seal")).toBeInTheDocument();
      expect(screen.getByTestId("reply-discard-confirm")).not.toHaveAttribute("open");
      expect(onLeave).not.toHaveBeenCalled();
      // The header's ? stays live (SealSigning.md).
      fireEvent.click(screen.getByRole("button", { name: "How signing works" }));
      expect(await screen.findByTestId("reply-help-dialog")).toBeInTheDocument();
    });

    it("ReplySealUploading.md:17 a failed upload drops the held press: the fault reading, Sign comment again, the ways out answer", async () => {
      const bytes = latchedUploads();
      const prepared = preparedCount();
      draw();
      await toGatedSeal();
      fireEvent.click(screen.getByTestId("reply-sign"));
      await bytes.answer("fail");
      await waitFor(() =>
        expect(screen.getByTestId("reply-seal-blocked")).toHaveTextContent(
          "One picture didn't upload. Signing waits for it.",
        ),
      );
      expect(screen.getByTestId("reply-sign")).toHaveTextContent("Sign comment");
      expect(screen.getByTestId("reply-sign")).toBeDisabled();
      expect(prepared.count).toBe(0);
      fireEvent.click(screen.getByTestId("header-leave"));
      await waitFor(() => expect(screen.getByTestId("reply-discard-confirm")).toHaveAttribute("open"));
    });

    it("ReplySealUploading.md:19 Retry runs the gate again, and nothing signs until Sign comment is pressed again", async () => {
      const bytes = latchedUploads();
      const prepared = preparedCount();
      const { onSigned } = draw();
      await toGatedSeal();
      fireEvent.click(screen.getByTestId("reply-sign"));
      await bytes.answer("fail");
      fireEvent.click(await screen.findByTestId("reply-seal-blocked-retry"));
      // ReplySealUploadFailed.md:17 — the line returns to its running reading, the commit enabled.
      await waitFor(() =>
        expect(screen.getByTestId("reply-seal-blocked")).toHaveTextContent("Uploading 0 of 1"),
      );
      expect(screen.getByTestId("reply-sign")).not.toBeDisabled();
      await bytes.answer("land");
      await waitFor(() => expect(screen.queryByTestId("reply-seal-blocked")).toBeNull());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(prepared.count).toBe(0);
      fireEvent.click(screen.getByTestId("reply-sign"));
      await waitFor(() => expect(onSigned).toHaveBeenCalled());
    });

    it("ReplySealUploading.md:21 the last upload landing unpressed takes the line away and leaves Sign comment as it was", async () => {
      const bytes = latchedUploads();
      const prepared = preparedCount();
      draw();
      await toGatedSeal();
      await bytes.answer("land");
      await waitFor(() => expect(screen.queryByTestId("reply-seal-blocked")).toBeNull());
      expect(screen.getByTestId("reply-sign")).toHaveTextContent("Sign comment");
      expect(screen.getByTestId("reply-sign")).not.toBeDisabled();
      expect(prepared.count).toBe(0);
    });
  });

  describe("leaving", () => {
    // NO COMMENT DRAFTS (jakob 2026-09-01): the X discards, so the label must
    // not promise the post wizard's kept draft.
    it("says the reply is discarded rather than kept, as every reply board's header does", () => {
      draw();
      expect(screen.getByTestId("header-leave")).toHaveAttribute(
        "aria-label",
        "Leave — the reply is discarded",
      );
    });

    it("ReplySeal: the seal's header carries Last step and the one ? as WizardHeader's pair", async () => {
      draw();
      await toSeal();
      expect(screen.getByTestId("header-stage")).toHaveTextContent("Last step");
      fireEvent.click(screen.getByRole("button", { name: "How signing works" }));
      expect(await screen.findByTestId("reply-help-dialog")).toBeInTheDocument();
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

  // jakob's hand test, 2026-09-23: the platform back gesture left the wizard
  // for the page behind it. The law (design/readme.md): the arrow steps ONE
  // STAGE BACK and "the platform back gesture does the same" — for this
  // surface, down to the thread it was opened over, never past it.
  describe("the browser's back and forward", () => {
    const stageDepth = () =>
      (window.history.state as { cograStage?: { depth: number } } | null)?.cograStage?.depth ?? 0;

    it("takes Back from the seal to the words, which are still there", async () => {
      const { onLeave } = draw();
      await toSeal("Worth keeping.");
      expect(stageDepth()).toBe(2);

      window.history.back();
      expect(await screen.findByTestId("reply-words")).toHaveValue("Worth keeping.");
      expect(screen.queryByTestId("reply-seal")).toBeNull();
      expect(onLeave).not.toHaveBeenCalled();
    });

    it("takes Back from an empty composer to the thread, as the arrow does", async () => {
      const { onLeave } = draw();
      expect(stageDepth()).toBe(1);

      window.history.back();
      await waitFor(() => expect(onLeave).toHaveBeenCalledOnce());
      expect(push).not.toHaveBeenCalled();
    });

    it("asks before Back discards written words, and keeps the wizard's entry", async () => {
      const { onLeave } = draw();
      write("half a thought");

      window.history.back();
      await waitFor(() =>
        expect(screen.getByTestId("reply-discard-confirm")).toHaveAttribute("open"),
      );
      expect(onLeave).not.toHaveBeenCalled();
      // The press is spent on the question; the wizard is still open, so it
      // stands on its own entry again.
      await waitFor(() => expect(stageDepth()).toBe(1));

      // A second Back is a close request on the question — the safe answer.
      window.history.back();
      await waitFor(() =>
        expect(screen.getByTestId("reply-discard-confirm")).not.toHaveAttribute("open"),
      );
      expect(onLeave).not.toHaveBeenCalled();
      expect(screen.getByTestId("reply-words")).toHaveValue("half a thought");
    });

    it("re-advances to the seal on Forward", async () => {
      draw();
      await toSeal();
      window.history.back();
      await screen.findByTestId("reply-words");

      window.history.forward();
      expect(await screen.findByTestId("reply-seal")).toBeInTheDocument();
    });

    it("closes an open sheet on Back before the stage steps back", async () => {
      draw();
      await toSeal();
      fireEvent.click(screen.getByTestId("reply-open-license"));
      const sheet = (await screen.findByTestId("reply-license-rows")).closest("dialog")!;
      expect(sheet).toHaveAttribute("open");

      window.history.back();
      await waitFor(() => expect(sheet).not.toHaveAttribute("open"));
      expect(screen.getByTestId("reply-seal")).toBeInTheDocument();
    });
  });
});

// A modal dialog over the thread's surface, so it announces itself as one
// (`covering-layer.tsx`; Feed.md:31) for as long as it is mounted.
describe("the reply wizard as a covering layer", () => {
  it("suspends the surface beneath it while it is up", () => {
    draw();
    expect(raisedLayersForTests()).toEqual(["suspend"]);
  });
});
