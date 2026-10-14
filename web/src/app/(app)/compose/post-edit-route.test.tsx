// The post edit, one screen and one batch — the EditCompose family's sidecars
// compiled to behavior (design/designs/canonical/behavior/EditCompose.md,
// EditComposeUnchanged.md, EditWords.md, EditPicked.md, EditActs.md). No Edit*
// board is registered yet (feed-card-rework §16), so these pin behavior by test
// id; the structural diff waits on registration.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { PostEditRoute } from "./post-edit-route";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("post=p1"),
}));

const server = startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function writes(count: number, family = "PUBLISH") {
  return Array.from({ length: count }, (_, i) => ({
    __typename: "PreparedWrite",
    id: `w${i}`,
    family,
    canonicalProposal: "cHJvcG9zYWw=",
    gcAfterEpochs: 8,
  }));
}

function editPrepared(count = 1) {
  return {
    preparePostEdit: {
      __typename: "PrepareContentPayload",
      node: "p1",
      writes: writes(count),
      userErrors: [],
    },
  };
}

function topicClaim(name: string, relevance = 0.1, confidence = 1) {
  return {
    __typename: "TopicClaim",
    hashtag: {
      __typename: "Hashtag",
      id: `ht-${name}`,
      name: { __typename: "ModeratedText", value: name, status: "NORMAL" },
    },
    relevance,
    confidence,
    pending: false,
  };
}

function referenceClaim(id: string, handle: string, withdrawalCost = 1) {
  return {
    __typename: "ReferenceClaim",
    targetId: `l1-${id}`,
    relevance: 0.1,
    support: 0.1,
    withdrawalCost,
    pending: false,
    target: {
      __typename: "User",
      id,
      handle,
      displayName: { __typename: "ModeratedText", value: handle },
    },
  };
}

function attachment(id: string, altText: string | null = null) {
  return {
    __typename: "MediaAttachment",
    id,
    url: `https://media.test/${id}.webp`,
    altText,
    status: "NORMAL",
    mimeType: "image/webp",
    options: { __typename: "MediaOptions", aspectRatio: "1:1", durationMs: null },
    coverMedia: null,
    coverTaken: false,
  };
}

function editablePost({
  topics = [] as ReturnType<typeof topicClaim>[],
  references = [] as ReturnType<typeof referenceClaim>[],
  attachments = [] as ReturnType<typeof attachment>[],
  description = null as string | null,
  license = { attribution: 0, provenance: 0 },
} = {}) {
  const media = attachments.length > 0;
  return {
    post: {
      __typename: "Post",
      id: "p1",
      title: { __typename: "ModeratedText", value: "Old title", status: "NORMAL" },
      description: { __typename: "ModeratedText", value: description, status: "NORMAL" },
      content: { __typename: "ModeratedText", value: media ? null : "Old body", status: "NORMAL" },
      attachments,
      attachmentsStatus: "NORMAL",
      author: { __typename: "User", id: "u1", handle: "alice" },
      createdAt: "2026-08-12T10:00:00Z",
      updatedAt: "2026-08-12T10:00:00Z",
      landing: { __typename: "Landing", state: "LANDED" },
      moderationStatus: "NORMAL",
      license: { __typename: "License", ...license },
      sensitiveSelfMark: false,
      sensitiveReason: null,
      topics,
      references,
      comments: {
        __typename: "CommentConnection",
        totalCount: 0,
        edges: [],
        pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
      },
    },
  };
}

function serve(data: ReturnType<typeof editablePost>) {
  server.use(graphql.query("PostDetail", () => HttpResponse.json({ data })));
}

function draw(
  options: { keyOnDevice?: boolean; signer?: ReturnType<typeof fakeWriteSigner> } = {},
) {
  const signer = options.signer ?? fakeWriteSigner();
  renderWithProviders(
    <PostEditRoute
      postId="p1"
      store={fakeIdentityStore({ keyOnDevice: options.keyOnDevice ?? true })}
    />,
    { store: signedInStore(), writeSigner: signer },
  );
  return signer;
}

const footer = () => screen.getByTestId("post-edit-acts-footer");
const sign = () => screen.getByTestId("post-edit-sign");

describe("PostEditRoute — the guard is the acts batch (EditComposeUnchanged)", () => {
  beforeEach(() => push.mockClear());

  it("an_empty_batch_leaves_sign_inert_and_the_footer_not_a_control", async () => {
    let prepared = false;
    serve(editablePost());
    server.use(
      graphql.mutation("PreparePostEdit", () => {
        prepared = true;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    await screen.findByTestId("post-edit");
    expect(footer()).toHaveTextContent("Nothing to sign yet");
    expect(footer().tagName).not.toBe("BUTTON");
    // Visible and inert, never hidden.
    expect(sign()).toBeVisible();
    expect(sign()).toBeDisabled();
    fireEvent.click(sign());
    expect(prepared).toBe(false);
    expect(signer.signStaged).not.toHaveBeenCalled();
  });

  it("a_typed_then_reverted_title_still_signs", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost());
    server.use(
      graphql.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    const title = await screen.findByTestId("post-edit-title");
    fireEvent.change(title, { target: { value: "Old title, edited" } });
    fireEvent.change(title, { target: { value: "Old title" } });
    // The first typed change staged the record, and typing it back keeps it.
    expect(footer()).toHaveTextContent("You're signing 1 thing");
    expect(sign()).not.toBeDisabled();
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(sent).toMatchObject({ id: "p1", title: "Old title", content: "Old body", description: null });
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
  });
});

describe("PostEditRoute — one batch (EditCompose, EditActs)", () => {
  beforeEach(() => push.mockClear());

  it("withdraws a standing tag in place, with Undo, and counts it", async () => {
    serve(editablePost({ topics: [topicClaim("coastroad")] }));
    draw();
    fireEvent.click(await screen.findByTestId("post-edit-tag-0-remove"));
    expect(screen.getByTestId("post-edit-withdrawn-tag-coastroad")).toHaveTextContent(
      "Withdrawn: #coastroad",
    );
    expect(screen.getByLabelText("Undo withdrawing #coastroad")).toBeInTheDocument();
    expect(footer()).toHaveTextContent("You're signing 1 thing");

    fireEvent.click(screen.getByTestId("post-edit-withdrawn-tag-coastroad-undo"));
    expect(screen.queryByTestId("post-edit-withdrawn-tag-coastroad")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-edit-tag-0")).toBeInTheDocument();
    expect(footer()).toHaveTextContent("Nothing to sign yet");
  });

  it("unstages a tag picked in this same edit rather than withdrawing it", async () => {
    serve(editablePost());
    draw();
    fireEvent.change(await screen.findByTestId("post-edit-tag-input"), {
      target: { value: "saltmaps" },
    });
    fireEvent.click(screen.getByTestId("post-edit-tag-add"));
    expect(footer()).toHaveTextContent("You're signing 1 thing");
    fireEvent.click(screen.getByTestId("post-edit-tag-0-remove"));
    expect(screen.queryByText(/Withdrawn:/)).not.toBeInTheDocument();
    expect(footer()).toHaveTextContent("Nothing to sign yet");
  });

  it("counts a citation's withdrawal at its counter-records", async () => {
    serve(editablePost({ references: [referenceClaim("u-juno", "juno", 2)] }));
    draw();
    fireEvent.click(await screen.findByTestId("post-edit-reference-0-remove"));
    expect(screen.getByText(/Withdrawn:/)).toBeInTheDocument();
    expect(footer()).toHaveTextContent("You're signing 2 things");
  });

  it("opens the acts sheet from the foot, every kind counted in records", async () => {
    serve(
      editablePost({
        topics: [topicClaim("coastroad")],
        references: [referenceClaim("u-juno", "juno", 2)],
      }),
    );
    draw();
    fireEvent.change(await screen.findByTestId("post-edit-title"), {
      target: { value: "Salt maps" },
    });
    fireEvent.click(screen.getByTestId("post-edit-tag-0-remove"));
    fireEvent.click(screen.getByTestId("post-edit-reference-0-remove"));
    expect(footer()).toHaveTextContent("You're signing 4 things");

    fireEvent.click(footer());
    const sheet = await screen.findByTestId("post-edit-acts");
    expect(within(sheet).getByText("4 things, signed together")).toBeInTheDocument();
    expect(within(sheet).getByTestId("post-edit-acts-row-edit")).toHaveTextContent("Salt maps");
    expect(within(sheet).getByTestId("post-edit-acts-row-tagsWithdrawn")).toHaveTextContent(
      "#coastroad",
    );
    expect(within(sheet).getByTestId("post-edit-acts-row-citationsWithdrawn")).toHaveTextContent(
      "2",
    );
    expect(within(sheet).getByText("They land together, or none does.")).toBeInTheDocument();
  });

  it("stages the edit record, the tag acts and a withdrawal in one signing pass", async () => {
    const tagInputs: unknown[] = [];
    let withdrawal: unknown;
    serve(
      editablePost({
        topics: [topicClaim("wasm")],
        references: [referenceClaim("u-juno", "juno", 2)],
      }),
    );
    server.use(
      graphql.mutation("PreparePostEdit", () => HttpResponse.json({ data: editPrepared() })),
      graphql.mutation("PrepareTag", ({ variables }) => {
        tagInputs.push(variables.input);
        return HttpResponse.json({
          data: { prepareTag: { __typename: "PreparePayload", writes: writes(1, "TAG"), userErrors: [] } },
        });
      }),
      graphql.mutation("PrepareReferenceWithdrawal", ({ variables }) => {
        withdrawal = variables.input;
        return HttpResponse.json({
          data: {
            prepareReferenceWithdrawal: {
              __typename: "PreparePayload",
              writes: writes(2, "REFERENCE"),
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = draw();
    fireEvent.change(await screen.findByTestId("post-edit-words"), {
      target: { value: "New body" },
    });
    fireEvent.click(screen.getByTestId("post-edit-tag-0-remove"));
    fireEvent.click(screen.getByTestId("post-edit-reference-0-remove"));
    // Sign is the confirmation: no dialog asks again (EditActs.jsx).
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(tagInputs).toEqual([{ target: "p1", name: "wasm", pDirected: 0, pInterest: null }]);
    expect(withdrawal).toEqual({ artifact: "p1", target: "u-juno" });
    expect(signer.signStaged).toHaveBeenCalledTimes(4);
  });

  it("shows the license as signed, its name and the lock, with no action", async () => {
    serve(editablePost({ license: { attribution: 1, provenance: 0 } }));
    draw();
    expect(await screen.findByTestId("post-edit-license")).toHaveTextContent(
      "Credit always · Not logged",
    );
    expect(screen.getByLabelText("The license never changes")).toBeInTheDocument();
  });
});

describe("PostEditRoute — the body (EditWords, EditPicked)", () => {
  beforeEach(() => push.mockClear());

  it("the words edit carries a title and no description field", async () => {
    serve(editablePost({ description: "left over" }));
    draw();
    expect(await screen.findByTestId("post-edit-words")).toHaveValue("Old body");
    expect(screen.queryByTestId("post-edit-description")).not.toBeInTheDocument();
    expect(screen.getByText("A post’s body is words or media, never both.")).toBeInTheDocument();
  });

  it("puts the words body's cap line under it and holds the sign", async () => {
    serve(editablePost());
    draw();
    fireEvent.change(await screen.findByTestId("post-edit-words"), {
      target: { value: "x".repeat(5001) },
    });
    expect(screen.getByText("A post's words are at most 5,000 characters.")).toBeInTheDocument();
    expect(sign()).toBeDisabled();
  });

  it("re-states the gallery in its new order after a move in the manager", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost({ attachments: [attachment("m-1", "A jetty"), attachment("m-2")] }));
    server.use(
      graphql.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    draw();
    fireEvent.click(await screen.findByLabelText("Manage the 2 pictures"));
    fireEvent.click(await screen.findByTestId("post-edit-picked-sheet-make-cover-1"));
    fireEvent.click(screen.getByTestId("post-edit-picked-sheet-done"));
    expect(footer()).toHaveTextContent("You're signing 1 thing");
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect((sent as unknown as { attachments: { mediaId: string }[] }).attachments.map((a) => a.mediaId)).toEqual([
      "m-2",
      "m-1",
    ]);
  });

  it("the_last_picture_leaving_drops_the_standing_description", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost({ attachments: [attachment("m-1")], description: "Rubbings at low tide." }));
    server.use(
      graphql.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    draw();
    expect(await screen.findByTestId("post-edit-description")).toHaveValue("Rubbings at low tide.");
    fireEvent.click(screen.getByLabelText("Manage the picture"));
    fireEvent.click(await screen.findByTestId("post-edit-picked-sheet-remove-0"));
    // The sheet closes onto the words edit, the field empty and no description.
    const words = await screen.findByTestId("post-edit-words");
    expect(words).toHaveValue("");
    expect(screen.queryByTestId("post-edit-description")).not.toBeInTheDocument();
    fireEvent.change(words, { target: { value: "Now it is words." } });
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(sent).toMatchObject({ description: null, content: "Now it is words." });
  });
});

describe("PostEditRoute — signing", () => {
  beforeEach(() => push.mockClear());

  it("stands the key-absent seal and stages nothing without the key", async () => {
    let prepared = false;
    serve(editablePost());
    server.use(
      graphql.mutation("PreparePostEdit", () => {
        prepared = true;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    draw({ keyOnDevice: false });
    fireEvent.change(await screen.findByTestId("post-edit-words"), { target: { value: "x" } });
    fireEvent.click(sign());
    expect(await screen.findByTestId("home_restore")).toBeInTheDocument();
    expect(prepared).toBe(false);
  });

  it("takes the commit's place with the write rule's notice and no Retry", async () => {
    serve(editablePost());
    server.use(
      graphql.mutation("PreparePostEdit", () =>
        HttpResponse.json({
          data: {
            preparePostEdit: {
              __typename: "PrepareContentPayload",
              node: null,
              writes: [],
              userErrors: [
                { __typename: "UserError", code: "WRITE_RULE_FAILED", field: null, message: "no" },
              ],
            },
          },
        }),
      ),
    );
    const signer = draw();
    fireEvent.change(await screen.findByTestId("post-edit-words"), { target: { value: "x" } });
    fireEvent.click(sign());
    expect(await screen.findByTestId("post-edit-write-rule")).toHaveTextContent(
      "You can’t sign right now.",
    );
    expect(screen.queryByTestId("post-edit-sign")).not.toBeInTheDocument();
    expect(screen.queryByText(/Retry/)).not.toBeInTheDocument();
    expect(signer.signStaged).not.toHaveBeenCalled();
  });

  it("drops the held press when the prepared count is not the one the foot read", async () => {
    serve(editablePost());
    server.use(
      graphql.mutation("PreparePostEdit", () => HttpResponse.json({ data: editPrepared(2) })),
    );
    const signer = draw();
    fireEvent.change(await screen.findByTestId("post-edit-words"), { target: { value: "x" } });
    fireEvent.click(sign());
    expect(await screen.findByTestId("post-edit-acts-footer-subline")).toHaveTextContent(
      "The count changed while you were editing — check it, then sign again.",
    );
    expect(signer.signStaged).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
