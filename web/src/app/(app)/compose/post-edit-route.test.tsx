// The post edit, one screen and one batch — the EditCompose family's sidecars
// compiled to behavior (design/designs/canonical/behavior/EditCompose.md,
// EditComposeUnchanged.md, EditWords.md, EditPicked.md, EditActs.md). No Edit*
// board is registered yet (feed-card-rework §16), so these pin behavior by test
// id; the structural diff waits on registration.

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  server.use(
    graphql.query("PostDetail", () => HttpResponse.json({ data })),
    // The kept placements' digests, read back by id at sign time — no
    // gallery read selects them (payload-expectation.ts).
    graphql.query("MediaAttachmentStatus", ({ variables }) =>
      HttpResponse.json({
        data: {
          mediaAttachment: {
            ...attachment(variables.id as string),
            state: "READY",
            failureReason: null,
            digest: "11".repeat(32),
            uploadDigest: "11".repeat(32),
          },
        },
      }),
    ),
  );
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

// Round 15 (PR-101): the edit's record carries THE AUTHOR'S PICK — its own
// attachment, 0.00 unless moved (PICK-IS-THE-EDGE; EditCompose.md, EditPad.md).
describe("PostEditRoute — your backing (EditCompose, EditPad)", () => {
  beforeEach(() => push.mockClear());

  it("stands Your backing under the License row, with Adjust", async () => {
    serve(editablePost());
    draw();
    await screen.findByTestId("post-edit");
    const row = screen.getByTestId("post-edit-open-backing").parentElement!;
    expect(within(row).getByText("Your backing")).toBeInTheDocument();
    expect(screen.getByTestId("post-edit-open-backing")).toHaveTextContent("Adjust");
    const license = screen.getByTestId("post-edit-license").parentElement!;
    expect(license.nextElementSibling).toBe(row);
    // "opinion" is the face record's word, never the authoring row's.
    expect(screen.queryByText(/your opinion/i)).not.toBeInTheDocument();
  });

  // THE SERVER GAP (`fetchPostBacking`): no read serves the author's Publish
  // bundle, so the row's reading stops at the flagged placeholder.
  it("stops the row's reading at the placeholder while the backing is unread", async () => {
    serve(editablePost());
    draw();
    await screen.findByTestId("post-edit");
    expect(screen.getByTestId("post-edit-backing-unread")).toHaveTextContent("Not readable yet");
  });

  it("an unmoved pick leaves the batch empty and travels as 0 with any change", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost());
    server.use(
      graphql.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    await screen.findByTestId("post-edit");
    expect(footer()).toHaveTextContent("Nothing to sign yet");
    fireEvent.change(screen.getByTestId("post-edit-title"), { target: { value: "New title" } });
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(sent).toMatchObject({ pDirected: 0 });
    const expected = vi.mocked(signer.sign).mock.calls[0]![1] as unknown as { writes: { pDirected: number; pInterest: number }[] };
    expect(expected.writes[0]).toMatchObject({ pDirected: 0, pInterest: 1 });
  });

  it("a moved pick alone fills the batch and signs the edit at the pick, never a delta", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost());
    server.use(
      graphql.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    await screen.findByTestId("post-edit");

    fireEvent.click(screen.getByTestId("post-edit-open-backing"));
    const pad = await screen.findByTestId("post-edit-backing-pad");
    expect(pad).toHaveAttribute("open");
    // The pad opens at the edit's own pick: 0.00.
    expect(screen.getByTestId("post-edit-backing-pad-pick-exact")).toHaveTextContent("+0.00");
    // Moving the strip stages nothing: the footer holds until Set.
    fireEvent.keyDown(screen.getByTestId("post-edit-backing-pad-field-strip"), {
      key: "ArrowRight",
      shiftKey: true,
    });
    expect(footer()).toHaveTextContent("Nothing to sign yet");
    fireEvent.click(screen.getByTestId("post-edit-backing-pad-set"));
    expect(screen.queryByTestId("post-edit-backing-pad")).not.toBeInTheDocument();

    // A moved pick alone is a legal edit: one record, the count unmoved by the pick.
    expect(footer()).toHaveTextContent("You're signing 1 thing");
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    // Content-identical, the pick riding the edit's own record.
    expect(sent).toMatchObject({ id: "p1", title: "Old title", content: "Old body", pDirected: 0.2 });
    const expected = vi.mocked(signer.sign).mock.calls[0]![1] as unknown as { writes: { family: string; pDirected: number; pInterest: number }[] };
    expect(expected.writes).toHaveLength(1);
    expect(expected.writes[0]).toMatchObject({ family: "publish", pDirected: 0.2, pInterest: 1 });
  });

  it("re-opens at the pick as set, and Cancel puts nothing back", async () => {
    serve(editablePost());
    draw();
    await screen.findByTestId("post-edit");
    fireEvent.click(screen.getByTestId("post-edit-open-backing"));
    fireEvent.keyDown(await screen.findByTestId("post-edit-backing-pad-field-strip"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByTestId("post-edit-backing-pad-set"));
    fireEvent.click(screen.getByTestId("post-edit-open-backing"));
    expect(await screen.findByTestId("post-edit-backing-pad-pick-exact")).toHaveTextContent("-0.05");
    fireEvent.keyDown(screen.getByTestId("post-edit-backing-pad-field-strip"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByTestId("post-edit-backing-pad-cancel"));
    fireEvent.click(screen.getByTestId("post-edit-open-backing"));
    expect(await screen.findByTestId("post-edit-backing-pad-pick-exact")).toHaveTextContent("-0.05");
  });

  it("a Set at 0.00 asks nothing and adds no record", async () => {
    serve(editablePost());
    draw();
    await screen.findByTestId("post-edit");
    fireEvent.click(screen.getByTestId("post-edit-open-backing"));
    fireEvent.click(await screen.findByTestId("post-edit-backing-pad-set"));
    expect(screen.queryByText("Start it unreachable?")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-edit-backing-pad")).not.toBeInTheDocument();
    expect(footer()).toHaveTextContent("Nothing to sign yet");
  });
});

describe("PostEditRoute — leaving (EditCompose, EditWords, DiscardConfirm): the edit keeps no draft", () => {
  beforeEach(() => push.mockClear());

  const ask = () => screen.getByTestId("post-edit-discard-confirm");

  it("the_x_is_named_leave_the_edit_is_discarded", async () => {
    serve(editablePost());
    draw();
    await screen.findByTestId("post-edit");
    expect(screen.getByRole("button", { name: "Leave — the edit is discarded" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Leave — your draft is kept" })).toBeNull();
  });

  it("an_empty_batch_leaves_at_once_by_the_x_and_the_back_arrow", async () => {
    serve(editablePost());
    draw();
    await screen.findByTestId("post-edit");
    fireEvent.click(screen.getByTestId("header-leave"));
    expect(push).toHaveBeenCalledWith("/posts/p1");
    fireEvent.click(screen.getByTestId("header-back"));
    expect(push).toHaveBeenCalledTimes(2);
    expect(ask()).not.toHaveAttribute("open");
  });

  it("a_staged_batch_asks_discard_the_changes_before_the_x_leaves", async () => {
    serve(editablePost());
    draw();
    fireEvent.change(await screen.findByTestId("post-edit-title"), { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("header-leave"));
    expect(push).not.toHaveBeenCalled();
    expect(ask()).toHaveAttribute("open");
    expect(ask()).toHaveTextContent("Discard the changes?");
    expect(ask()).toHaveTextContent("Nothing is kept.");
  });

  it("a_staged_batch_asks_the_same_before_the_back_arrow_leaves", async () => {
    serve(editablePost());
    draw();
    fireEvent.change(await screen.findByTestId("post-edit-title"), { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("header-back"));
    expect(push).not.toHaveBeenCalled();
    expect(ask()).toHaveAttribute("open");
  });

  it("a_withdrawal_alone_is_an_act_so_leaving_asks", async () => {
    serve(editablePost({ topics: [topicClaim("coastroad")] }));
    draw();
    fireEvent.click(await screen.findByTestId("post-edit-tag-0-remove"));
    fireEvent.click(screen.getByTestId("header-leave"));
    expect(push).not.toHaveBeenCalled();
    expect(ask()).toHaveAttribute("open");
  });

  it("keep_writing_closes_the_ask_onto_the_edit_as_it_was", async () => {
    serve(editablePost());
    draw();
    const title = await screen.findByTestId("post-edit-title");
    fireEvent.change(title, { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("header-leave"));
    fireEvent.click(screen.getByTestId("post-edit-discard-confirm-keep"));
    expect(ask()).not.toHaveAttribute("open");
    expect(push).not.toHaveBeenCalled();
    expect(title).toHaveValue("New title");
    expect(footer()).toHaveTextContent("You're signing 1 thing");
  });

  it("discard_leaves_toward_the_post_and_stages_or_signs_nothing", async () => {
    let prepared = false;
    serve(editablePost());
    server.use(
      graphql.mutation("PreparePostEdit", () => {
        prepared = true;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    fireEvent.change(await screen.findByTestId("post-edit-title"), { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("header-leave"));
    fireEvent.click(screen.getByTestId("post-edit-discard-confirm-discard"));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/posts/p1");
    expect(prepared).toBe(false);
    expect(signer.signStaged).not.toHaveBeenCalled();

    // Nothing is kept: the next edit opens on the post as it stands.
    cleanup();
    draw();
    expect(await screen.findByTestId("post-edit-title")).toHaveValue("Old title");
    expect(footer()).toHaveTextContent("Nothing to sign yet");
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
        topics: [topicClaim("wasm", 0.1, 0.6)],
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
    // The un-tag signs (0,0) whatever the removed chip showed (hashtag.md §4),
    // never a hole the server would fill.
    expect(tagInputs).toEqual([{ target: "p1", name: "wasm", pDirected: 0, pInterest: 0 }]);
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
