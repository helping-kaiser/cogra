// The post edit, one screen and one batch — the EditCompose family's sidecars
// compiled to behavior (design/designs/canonical/behavior/EditCompose.md,
// EditComposeUnchanged.md, EditWords.md, EditPicked.md, EditActs.md). No Edit*
// board is registered yet (feed-card-rework §16), so these pin behavior by test
// id; the structural diff waits on registration.

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { postBackingHandler } from "@/test/backing";
import { byNode } from "@/test/data-node";
import { fakeIdentityStore } from "@/test/identity";
import { gqlLink, startMswServer } from "@/test/msw";
import { echoedMedia } from "@/test/media-echo";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { PostEditRoute } from "./post-edit-route";
import { EDIT_LEAVE_LABEL } from "./post-edit-view";

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
  attachments = [] as Record<string, unknown>[],
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
      // No removal: the node stands (api-spec.md `Post.removal`).
      removal: null,
      genesisRecordId: "rec-genesis",
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

/**
 * The edit's two reads. `backing` is the author's raw sum (the wizard's +0.10
 * pre-fill by default); null answers as the server does for any viewer but the
 * creator — no backing served.
 */
function serve(data: ReturnType<typeof editablePost>, { backing = 0.1 as number | null } = {}) {
  server.use(
    gqlLink.query("PostDetail", () => HttpResponse.json({ data })),
    postBackingHandler({ p1: backing }),
    // The kept placements' digests, read back by id at sign time — no
    // gallery read selects them (payload-expectation.ts).
    gqlLink.query("MediaAttachmentStatus", ({ variables }) =>
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

const footer = () => screen.getByTestId("postEdit.acts.line");
const sign = () => screen.getByTestId("postEdit.sign");

describe("PostEditRoute — the guard is the acts batch (EditComposeUnchanged)", () => {
  beforeEach(() => push.mockClear());

  it("an_empty_batch_leaves_sign_inert_and_the_footer_not_a_control", async () => {
    let prepared = false;
    serve(editablePost());
    server.use(
      gqlLink.mutation("PreparePostEdit", () => {
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
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    const title = await screen.findByTestId("postEdit.title.input");
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
    const row = screen.getByTestId("postEdit.facts.backing.action").parentElement!;
    expect(within(row).getByText("Your backing")).toBeInTheDocument();
    expect(screen.getByTestId("postEdit.facts.backing.action")).toHaveTextContent("Adjust");
    const license = screen.getByTestId("postEdit.facts.license.value").parentElement!;
    expect(license.nextElementSibling).toBe(row);
    // "opinion" is the face record's word, never the authoring row's.
    expect(screen.queryByText(/your opinion/i)).not.toBeInTheDocument();
  });

  // THE LIVE READ (`Post.viewerBacking`): the row reads the backing WITH the
  // edit — clip(raw sum + pick) — and moves with a Set (EditCompose.md).
  it("reads the row off the live backing, and a Set moves it by the pick", async () => {
    serve(editablePost(), { backing: 0.1 });
    draw();
    expect(await screen.findByTestId("postEdit.facts.backing.value")).toHaveTextContent("+0.10");
    // The number is geek mode's (StanceReadout.jsx `ReadoutLine`): a `cg-exact` span.
    expect(screen.getByTestId("postEdit.facts.backing.value.exact").className).toContain("cg-exact");
    expect(screen.queryByTestId("post-edit-backing-unread")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    fireEvent.keyDown(await screen.findByTestId("post-edit-backing-pad-field-strip"), {
      key: "ArrowRight",
      shiftKey: true,
    });
    fireEvent.click(screen.getByTestId("post-edit-backing-pad-set"));
    expect(screen.getByTestId("postEdit.facts.backing.value")).toHaveTextContent("+0.30");
  });

  it("the pad reads Current backing and Backing after off the live read", async () => {
    serve(editablePost(), { backing: 0.1 });
    draw();
    await screen.findByTestId("post-edit");
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    await screen.findByTestId("post-edit-backing-pad");
    expect(screen.getByTestId("post-edit-backing-pad-current-exact")).toHaveTextContent("+0.10");
    expect(screen.getByTestId("post-edit-backing-pad-after-exact")).toHaveTextContent("+0.10");
    expect(screen.queryByTestId("post-edit-backing-pad-cap")).not.toBeInTheDocument();
  });

  // EditPad.md: past ±1 the after is clipped and a quiet line states the total.
  it("states the raw total and the cap when the live sum is past ±1", async () => {
    serve(editablePost(), { backing: 2 });
    draw();
    expect(await screen.findByTestId("postEdit.facts.backing.value")).toHaveTextContent("+1.00");
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    await screen.findByTestId("post-edit-backing-pad");
    expect(screen.getByTestId("post-edit-backing-pad-current-exact")).toHaveTextContent("+1.00");
    expect(screen.getByTestId("post-edit-backing-pad-after-exact")).toHaveTextContent("+1.00");
    expect(screen.getByTestId("post-edit-backing-pad-cap")).toHaveTextContent(
      "Adds up to +2.00; your feed reads it capped at +1.00.",
    );
  });

  it("Walk it all back parks against the live sum, and the edit signs that pick", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost(), { backing: 0.35 });
    server.use(
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    draw();
    await screen.findByTestId("postEdit.facts.backing.value");
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    const walk = await screen.findByTestId("post-edit-backing-pad-walk-back");
    expect(walk).not.toBeDisabled();
    fireEvent.click(walk);
    expect(screen.getByTestId("post-edit-backing-pad-pick-exact")).toHaveTextContent("−0.35");
    expect(screen.getByTestId("post-edit-backing-pad-after-exact")).toHaveTextContent("+0.00");
    fireEvent.click(screen.getByTestId("post-edit-backing-pad-set"));
    expect(screen.getByTestId("postEdit.facts.backing.value")).toHaveTextContent("+0.00");
    expect(footer()).toHaveTextContent("You're signing 1 thing");
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(sent).toMatchObject({ pDirected: -0.35 });
  });

  it("greys Walk it all back while the live backing already nets 0.00", async () => {
    serve(editablePost(), { backing: 0 });
    draw();
    await screen.findByTestId("postEdit.facts.backing.value");
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    expect(await screen.findByTestId("post-edit-backing-pad-walk-back")).toBeDisabled();
  });

  // No backing served — the server answers only the post's creator.
  it("stands unread when no backing is served, the walk-back greyed", async () => {
    serve(editablePost(), { backing: null });
    draw();
    await screen.findByTestId("post-edit");
    expect(screen.getByTestId("post-edit-backing-unread")).toHaveTextContent("Not readable yet");
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    await screen.findByTestId("post-edit-backing-pad");
    expect(screen.getByTestId("post-edit-backing-pad-current-unread")).toHaveTextContent("Not readable yet");
    expect(screen.getByTestId("post-edit-backing-pad-after-unread")).toHaveTextContent("Not readable yet");
    expect(screen.getByTestId("post-edit-backing-pad-walk-back")).toBeDisabled();
  });

  it("a failed backing read leaves the readouts unread and the edit opens anyway", async () => {
    serve(editablePost());
    server.use(gqlLink.query("PostBacking", () => HttpResponse.error()));
    draw();
    expect(await screen.findByTestId("postEdit.title.input")).toHaveValue("Old title");
    expect(screen.getByTestId("post-edit-backing-unread")).toHaveTextContent("Not readable yet");
    expect(screen.queryByTestId("post-edit-load-failed")).not.toBeInTheDocument();
  });

  // Viewer-scoped, so the read rides the guard: an access token that expired
  // refreshes and replays rather than reading as no backing at all.
  it("refreshes and replays the backing read on an expired token", async () => {
    serve(editablePost());
    server.use(
      gqlLink.mutation("RefreshSession", () =>
        HttpResponse.json({
          data: {
            refreshSession: {
              __typename: "AuthPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access-2",
                refreshToken: "refresh-2",
                user: { __typename: "User", id: "u1" },
              },
              userErrors: [],
            },
          },
        }),
      ),
      gqlLink.query("PostBacking", ({ request }) =>
        request.headers.get("authorization") === "Bearer access-2"
          ? HttpResponse.json({
              data: {
                post: {
                  __typename: "Post",
                  id: "p1",
                  viewerBacking: { __typename: "BackingBundle", rawPDirected: 0.4 },
                },
              },
            })
          : HttpResponse.json({
              data: null,
              errors: [{ message: "expired", extensions: { code: "UNAUTHENTICATED" } }],
            }),
      ),
    );
    draw();
    expect(await screen.findByTestId("postEdit.facts.backing.value")).toHaveTextContent("+0.40");
  });

  it("an unmoved pick leaves the batch empty and travels as 0 with any change", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost());
    server.use(
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    await screen.findByTestId("post-edit");
    expect(footer()).toHaveTextContent("Nothing to sign yet");
    fireEvent.change(screen.getByTestId("postEdit.title.input"), { target: { value: "New title" } });
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
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    await screen.findByTestId("post-edit");

    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
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
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    fireEvent.keyDown(await screen.findByTestId("post-edit-backing-pad-field-strip"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByTestId("post-edit-backing-pad-set"));
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    expect(await screen.findByTestId("post-edit-backing-pad-pick-exact")).toHaveTextContent("−0.05");
    fireEvent.keyDown(screen.getByTestId("post-edit-backing-pad-field-strip"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByTestId("post-edit-backing-pad-cancel"));
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
    expect(await screen.findByTestId("post-edit-backing-pad-pick-exact")).toHaveTextContent("−0.05");
  });

  it("a Set at 0.00 asks nothing and adds no record", async () => {
    serve(editablePost());
    draw();
    await screen.findByTestId("post-edit");
    fireEvent.click(screen.getByTestId("postEdit.facts.backing.action"));
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
    fireEvent.click(screen.getByTestId("postEdit.header.leave"));
    expect(push).toHaveBeenCalledWith("/posts/p1");
    fireEvent.click(screen.getByTestId("postEdit.header.back"));
    expect(push).toHaveBeenCalledTimes(2);
    expect(ask()).not.toHaveAttribute("open");
  });

  it("a_staged_batch_asks_discard_the_changes_before_the_x_leaves", async () => {
    serve(editablePost());
    draw();
    fireEvent.change(await screen.findByTestId("postEdit.title.input"), { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("postEdit.header.leave"));
    expect(push).not.toHaveBeenCalled();
    expect(ask()).toHaveAttribute("open");
    expect(ask()).toHaveTextContent("Discard the changes?");
    expect(ask()).toHaveTextContent("Nothing is kept.");
  });

  it("a_staged_batch_asks_the_same_before_the_back_arrow_leaves", async () => {
    serve(editablePost());
    draw();
    fireEvent.change(await screen.findByTestId("postEdit.title.input"), { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("postEdit.header.back"));
    expect(push).not.toHaveBeenCalled();
    expect(ask()).toHaveAttribute("open");
  });

  it("a_withdrawal_alone_is_an_act_so_leaving_asks", async () => {
    serve(editablePost({ topics: [topicClaim("coastroad")] }));
    draw();
    fireEvent.click(await screen.findByTestId("postEdit.tags.tag.remove"));
    fireEvent.click(screen.getByTestId("postEdit.header.leave"));
    expect(push).not.toHaveBeenCalled();
    expect(ask()).toHaveAttribute("open");
  });

  it("keep_writing_closes_the_ask_onto_the_edit_as_it_was", async () => {
    serve(editablePost());
    draw();
    const title = await screen.findByTestId("postEdit.title.input");
    fireEvent.change(title, { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("postEdit.header.leave"));
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
      gqlLink.mutation("PreparePostEdit", () => {
        prepared = true;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const signer = draw();
    fireEvent.change(await screen.findByTestId("postEdit.title.input"), { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("postEdit.header.leave"));
    fireEvent.click(screen.getByTestId("post-edit-discard-confirm-discard"));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/posts/p1");
    expect(prepared).toBe(false);
    expect(signer.signStaged).not.toHaveBeenCalled();

    // Nothing is kept: the next edit opens on the post as it stands.
    cleanup();
    draw();
    expect(await screen.findByTestId("postEdit.title.input")).toHaveValue("Old title");
    expect(footer()).toHaveTextContent("Nothing to sign yet");
  });
});

describe("PostEditRoute — one batch (EditCompose, EditActs)", () => {
  beforeEach(() => push.mockClear());

  it("withdraws a standing tag in place, with Undo, and counts it", async () => {
    serve(editablePost({ topics: [topicClaim("coastroad")] }));
    draw();
    fireEvent.click(await screen.findByTestId("postEdit.tags.tag.remove"));
    expect(screen.getByTestId("postEdit.tags.withdrawn")).toHaveTextContent(
      "Withdrawn: #coastroad",
    );
    // The undo is NAMED by what it undoes (EditCompose's `withdrawn.undo`): the
    // name rides the button itself, never a wrapper the button does not take.
    expect(screen.getByRole("button", { name: "Undo withdrawing #coastroad" })).toBe(
      screen.getByTestId("postEdit.tags.withdrawn.undo"),
    );
    expect(footer()).toHaveTextContent("You're signing 1 thing");

    fireEvent.click(screen.getByTestId("postEdit.tags.withdrawn.undo"));
    expect(screen.queryByTestId("postEdit.tags.withdrawn")).not.toBeInTheDocument();
    expect(screen.getByTestId("postEdit.tags.tag")).toBeInTheDocument();
    expect(footer()).toHaveTextContent("Nothing to sign yet");
  });

  // EditCompose draws `+ Add a tag` and `+ Cite something` — the composer's
  // quiet doors — so the edit adds through the pickers, in the edit's place,
  // and Done brings the edit back with the pick already staged.
  it("adds a tag through the tag picker, in the edit's place, and Done returns to the edit", async () => {
    serve(editablePost());
    draw();
    expect(await screen.findByTestId("postEdit.tags.add")).toHaveTextContent("+ Add a tag");
    fireEvent.click(screen.getByTestId("postEdit.tags.add"));
    const field = await screen.findByRole("searchbox", { name: "Name a tag" });
    expect(screen.queryByTestId("post-edit")).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: "saltmaps" } });
    fireEvent.click(await screen.findByTestId(byNode("tagPicker.tag", "saltmaps")));
    fireEvent.click(screen.getByTestId("tagPicker.done"));
    expect(await screen.findByTestId(byNode("postEdit.tags.tag", "saltmaps"))).toBeInTheDocument();
    expect(footer()).toHaveTextContent("You're signing 1 thing");
  });

  it("cites through the citation picker, in the edit's place", async () => {
    serve(editablePost());
    draw();
    fireEvent.click(await screen.findByTestId("postEdit.references.add"));
    expect(await screen.findByRole("searchbox", { name: "Cite something" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("referencePicker.done"));
    expect(await screen.findByTestId("postEdit.header")).toBeInTheDocument();
    expect(footer()).toHaveTextContent("Nothing to sign yet");
  });

  it("unstages a tag picked in this same edit rather than withdrawing it", async () => {
    serve(editablePost());
    draw();
    fireEvent.click(await screen.findByTestId("postEdit.tags.add"));
    fireEvent.change(await screen.findByRole("searchbox", { name: "Name a tag" }), {
      target: { value: "saltmaps" },
    });
    fireEvent.click(await screen.findByTestId(byNode("tagPicker.tag", "saltmaps")));
    fireEvent.click(screen.getByTestId("tagPicker.done"));
    await screen.findByTestId("postEdit.header");
    expect(footer()).toHaveTextContent("You're signing 1 thing");
    fireEvent.click(screen.getByTestId("postEdit.tags.tag.remove"));
    expect(screen.queryByText(/Withdrawn:/)).not.toBeInTheDocument();
    expect(footer()).toHaveTextContent("Nothing to sign yet");
  });

  it("counts a citation's withdrawal at its counter-records", async () => {
    serve(editablePost({ references: [referenceClaim("u-juno", "juno", 2)] }));
    draw();
    fireEvent.click(await screen.findByTestId("postEdit.references.stagedReference.remove"));
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
    fireEvent.change(await screen.findByTestId("postEdit.title.input"), {
      target: { value: "Salt maps" },
    });
    fireEvent.click(screen.getByTestId("postEdit.tags.tag.remove"));
    fireEvent.click(screen.getByTestId("postEdit.references.stagedReference.remove"));
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
      gqlLink.mutation("PreparePostEdit", () => HttpResponse.json({ data: editPrepared() })),
      gqlLink.mutation("PrepareTag", ({ variables }) => {
        tagInputs.push(variables.input);
        return HttpResponse.json({
          data: { prepareTag: { __typename: "PreparePayload", writes: writes(1, "TAG"), userErrors: [] } },
        });
      }),
      gqlLink.mutation("PrepareReferenceWithdrawal", ({ variables }) => {
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
    fireEvent.change(await screen.findByTestId("postEdit.body.words.input"), {
      target: { value: "New body" },
    });
    fireEvent.click(screen.getByTestId("postEdit.tags.tag.remove"));
    fireEvent.click(screen.getByTestId("postEdit.references.stagedReference.remove"));
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
    expect(await screen.findByTestId("postEdit.facts.license.value")).toHaveTextContent(
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
    expect(await screen.findByTestId("postEdit.body.words.input")).toHaveValue("Old body");
    expect(screen.queryByTestId("postEdit.description.input")).not.toBeInTheDocument();
    expect(screen.getByText("A post’s body is words or media, never both.")).toBeInTheDocument();
  });

  it("puts the words body's cap line under it and holds the sign", async () => {
    serve(editablePost());
    draw();
    fireEvent.change(await screen.findByTestId("postEdit.body.words.input"), {
      target: { value: "x".repeat(5001) },
    });
    expect(screen.getByText("A post's words are at most 5,000 characters.")).toBeInTheDocument();
    expect(sign()).toBeDisabled();
  });

  it("re-states the gallery in its new order after a move in the manager", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost({ attachments: [attachment("m-1", "A jetty"), attachment("m-2")] }));
    server.use(
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    draw();
    fireEvent.click(await screen.findByLabelText("Manage the 2 pictures"));
    fireEvent.click(await screen.findByTestId(byNode("postEdit.pickedSheet.picture.makeCover", "2")));
    fireEvent.click(screen.getByTestId("postEdit.pickedSheet.done"));
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
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as Record<string, unknown>;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    draw();
    expect(await screen.findByTestId("postEdit.description.input")).toHaveValue("Rubbings at low tide.");
    fireEvent.click(screen.getByLabelText("Manage the picture"));
    fireEvent.click(await screen.findByTestId(byNode("postEdit.pickedSheet.picture.remove", "1")));
    // The sheet closes onto the words edit, the field empty and no description.
    const words = await screen.findByTestId("postEdit.body.words.input");
    expect(words).toHaveValue("");
    expect(screen.queryByTestId("postEdit.description.input")).not.toBeInTheDocument();
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
      gqlLink.mutation("PreparePostEdit", () => {
        prepared = true;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    draw({ keyOnDevice: false });
    fireEvent.change(await screen.findByTestId("postEdit.body.words.input"), { target: { value: "x" } });
    fireEvent.click(sign());
    expect(await screen.findByTestId("home_restore")).toBeInTheDocument();
    expect(prepared).toBe(false);
  });

  it("takes the commit's place with the write rule's notice and no Retry", async () => {
    serve(editablePost());
    server.use(
      gqlLink.mutation("PreparePostEdit", () =>
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
    fireEvent.change(await screen.findByTestId("postEdit.body.words.input"), { target: { value: "x" } });
    fireEvent.click(sign());
    // EditCompose.md: "the notice's fact ends Nothing was signed or spent —
    // your edit is still here. AND the way out under the notice reads Not now
    // AND NEVER the notice says a draft is kept AND NEVER Retry appears".
    const notice = await screen.findByTestId("post-edit-write-rule");
    expect(notice).toHaveTextContent("You can't sign right now");
    expect(notice).toHaveTextContent(/Nothing was signed or spent — your edit is still here\.$/);
    expect(notice).not.toHaveTextContent(/draft/);
    expect(screen.queryByTestId("postEdit.sign")).not.toBeInTheDocument();
    expect(screen.queryByText(/Retry/)).not.toBeInTheDocument();
    expect(signer.signStaged).not.toHaveBeenCalled();
    // Not now: the notice goes and the edit stands again with the batch as it was.
    fireEvent.click(screen.getByTestId("post-edit-not-now"));
    expect(screen.queryByTestId("post-edit-write-rule")).not.toBeInTheDocument();
    expect(footer()).toHaveTextContent("You're signing 1 thing");
    expect(sign()).not.toBeDisabled();
  });

  it("drops the held press when the prepared count is not the one the foot read", async () => {
    serve(editablePost());
    server.use(
      gqlLink.mutation("PreparePostEdit", () => HttpResponse.json({ data: editPrepared(2) })),
    );
    const signer = draw();
    fireEvent.change(await screen.findByTestId("postEdit.body.words.input"), { target: { value: "x" } });
    fireEvent.click(sign());
    expect(await screen.findByTestId("post-edit-acts-footer-subline")).toHaveTextContent(
      "The count changed while you were editing — check it, then sign again.",
    );
    expect(signer.signStaged).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

// ---- the add paths (FC-8 remainder) -----------------------------------------
//
// EditCompose.md, EditComposeVideo.md and EditWords.md compiled: `+ Add
// pictures`, the crop locked to the post's one shape, a clip's new face
// through the cover's crop, and the upload gate with the held press. The
// bytes really go up — the encoder stubbed (jsdom has no canvas), the upload
// answered by MSW and held open where a line needs it running.

// The device's upload digest, pinned so the server can echo it (test/media-echo.ts).
vi.mock("@/lib/api/media-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/media-api")>()),
  uploadDigestOf: async () => "ee".repeat(32),
}));

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
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:preview", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
}

/**
 * The upload, answered as the test says: each call waits on its own latch,
 * and lands READY under the next id or fails on the network.
 */
function uploads() {
  const latches: { release: (outcome: "land" | "fail") => void }[] = [];
  let next = 0;
  let calls = 0;
  server.use(
    gqlLink.mutation("UploadMedia", async () => {
      calls += 1;
      const outcome = await new Promise<"land" | "fail">((resolve) => latches.push({ release: resolve }));
      if (outcome === "fail") return HttpResponse.error();
      return HttpResponse.json({
        data: {
          uploadMedia: {
            __typename: "UploadMediaPayload",
            media: echoedMedia(`up-${next++}`),
            userErrors: [],
          },
        },
      });
    }),
  );
  return {
    calls: () => calls,
    /** Lets the oldest waiting upload answer, once it has been asked. */
    async answer(outcome: "land" | "fail" = "land") {
      await waitFor(() => expect(latches.length).toBeGreaterThan(0));
      latches.shift()!.release(outcome);
    },
  };
}

function picture(name: string, type = "image/jpeg") {
  return new File([new Uint8Array([1, 2, 3]) as BlobPart], name, { type });
}

/** Hands files to a hidden input the way a real picker's change event does. */
async function pickInto(testId: string, files: File[]) {
  const input = await screen.findByTestId(testId);
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
  // The screening reads each file's bytes before anything joins.
  await act(async () => {});
}

function clipAttachment({ coverTaken = false, cover = true } = {}) {
  return {
    __typename: "MediaAttachment",
    id: "clip-1",
    url: "https://media.test/clip-1.mp4",
    altText: null,
    status: "NORMAL",
    mimeType: "video/mp4",
    options: { __typename: "MediaOptions", aspectRatio: "9:16", durationMs: 18_000 },
    coverMedia: cover
      ? {
          __typename: "MediaAttachment",
          id: "face-1",
          url: "https://media.test/face-1.webp",
          status: "NORMAL",
          options: { __typename: "MediaOptions", aspectRatio: "9:16" },
        }
      : null,
    coverTaken,
  };
}

const gate = () => screen.queryByTestId("postEdit.gate");

/** One more picture picked on a picture post, the crop standing. */
async function cropOneMore() {
  fireEvent.click(await screen.findByTestId("postEdit.body.add"));
  await pickInto("post-edit-add-pictures-input", [picture("third.jpg")]);
  return screen.findByTestId("post-edit-crop");
}

describe("PostEditRoute — + Add pictures (EditCompose)", () => {
  beforeEach(() => {
    push.mockClear();
    installEncoder();
  });

  it("reads the cap on the add control and opens the device's own picker, never a pick stage", async () => {
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    draw();
    const add = await screen.findByTestId("postEdit.body.add");
    expect(add).toHaveTextContent("+ Add pictures · 2 of 10");
    const input = screen.getByTestId("post-edit-add-pictures-input") as HTMLInputElement;
    const opened = vi.spyOn(input, "click");
    fireEvent.click(add);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(input.accept).toBe("image/*");
    expect(screen.queryByTestId("wizard-file-input")).not.toBeInTheDocument();
    // The body rule stands under the add control.
    expect(screen.getByTestId("postEdit.body.rule")).toHaveTextContent(
      "A post’s body is words or media, never both.",
    );
  });

  // ComposeCrop.md: "the crop is reached by adding pictures to a published
  // post's edit -> the crop is locked to the post's one shape".
  it("passes the picked pictures through the crop locked to the post's shape, the row growing by them", async () => {
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    uploads();
    draw();
    const crop = await cropOneMore();
    expect(within(crop).queryByRole("group", { name: "The post's shape" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("composeCrop.shapes.tallChip")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("composeCrop.next"));
    expect(await screen.findByLabelText("Manage the 3 pictures")).toBeInTheDocument();
    expect(footer()).toHaveTextContent("You're signing 1 thing");
  });

  it("the crop's back arrow returns to the edit as it was, the pictures unused", async () => {
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    const sent = uploads();
    draw();
    await cropOneMore();
    fireEvent.click(within(screen.getByTestId("composeCrop.header")).getByLabelText("Back to the edit"));
    expect(await screen.findByLabelText("Manage the 2 pictures")).toBeInTheDocument();
    expect(footer()).toHaveTextContent("Nothing to sign yet");
    expect(sent.calls()).toBe(0);
  });

  // ComposeCrop.md: "press the header X GIVEN the crop was entered from an
  // edit -> DiscardConfirm opens, as the edit's own X raises it".
  it("the crop's X is the edit's own X: it asks first where the batch holds an act", async () => {
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    draw();
    fireEvent.change(await screen.findByTestId("postEdit.title.input"), { target: { value: "New title" } });
    await cropOneMore();
    fireEvent.click(within(screen.getByTestId("composeCrop.header")).getByLabelText(EDIT_LEAVE_LABEL));
    await waitFor(() => expect(screen.getByTestId("post-edit-discard-confirm")).toHaveAttribute("open"));
    expect(push).not.toHaveBeenCalled();
  });

  // EditCompose.md: "break the cap of ten or come in a format nothing here
  // reads -> the refusal says why on the media row AND NEVER a dialog opens".
  it("refuses past ten and an unreadable file on the media row, never in a dialog", async () => {
    serve(editablePost({ attachments: Array.from({ length: 9 }, (_, i) => attachment(`m-${i}`)) }));
    uploads();
    draw();
    fireEvent.click(await screen.findByTestId("postEdit.body.add"));
    await pickInto("post-edit-add-pictures-input", [
      picture("ten.jpg"),
      picture("eleven.jpg"),
      picture("notes.txt", "text/plain"),
    ]);
    // What fit goes on through the crop; the edit holds the refusals for its return.
    fireEvent.click(await screen.findByTestId("composeCrop.next"));
    const refusals = await screen.findByTestId("post-edit-refusals");
    expect(refusals).toHaveTextContent("That's more than a post carries — up to ten pictures.");
    expect(refusals).toHaveTextContent("That file isn't a picture or a video CoGra can read.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Remove it is the only way out, and the line leaves with it.
    const overCap = within(refusals)
      .getAllByRole("listitem")
      .find((row) => /up to ten pictures/.test(row.textContent ?? ""))!;
    fireEvent.click(within(overCap).getByText("Remove it"));
    expect(screen.getByTestId("post-edit-refusals")).not.toHaveTextContent("up to ten pictures");
  });

  it("stands the gate over the foot while the picture uploads, enabled, and lets it go when the bytes land", async () => {
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    const sent = uploads();
    draw();
    await cropOneMore();
    fireEvent.click(screen.getByTestId("composeCrop.next"));
    expect(await screen.findByTestId("postEdit.gate")).toHaveTextContent(
      "Uploading 0 of 1 — signing waits for the picture.",
    );
    // EditCompose.md: "Sign the edit is enabled GIVEN an upload is running".
    expect(sign()).not.toBeDisabled();
    await sent.answer("land");
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    // EditCompose.md: "the last upload lands GIVEN Sign the edit was not
    // pressed -> the upload line goes AND Sign the edit stays as it was".
    expect(sign()).not.toBeDisabled();
    expect(sign()).toHaveTextContent("Sign the edit");
    expect(push).not.toHaveBeenCalled();
  });

  it("counts the pictures the edit took in the gate's noun", async () => {
    serve(editablePost({ attachments: [attachment("m-1")] }));
    uploads();
    draw();
    fireEvent.click(await screen.findByTestId("postEdit.body.add"));
    await pickInto("post-edit-add-pictures-input", [picture("a.jpg"), picture("b.jpg")]);
    fireEvent.click(await screen.findByTestId("composeCrop.next"));
    expect(await screen.findByTestId("postEdit.gate")).toHaveTextContent(
      "Uploading 0 of 2 — signing waits for the pictures.",
    );
  });

  // EditCompose.md: "press Sign the edit GIVEN an upload is running -> Sign the
  // edit refuses a second press AND NEVER anything is signed before the last
  // upload lands AND NEVER Sign the edit dims" … "the last upload lands GIVEN
  // Sign the edit was pressed while the uploads ran -> signing proceeds AND
  // NEVER a second press is asked".
  it("holds a press at the gate and signs the moment the last upload lands, with no second press", async () => {
    let sent: { attachments: { mediaId: string }[] } | null = null;
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    server.use(
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as never;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const bytes = uploads();
    const signer = draw();
    await cropOneMore();
    fireEvent.click(screen.getByTestId("composeCrop.next"));
    await screen.findByTestId("postEdit.gate");
    fireEvent.click(sign());
    fireEvent.click(sign());
    expect(sign()).not.toBeDisabled();
    // Past 200ms the commit reads its in-flight label in its own place.
    await waitFor(() => expect(sign()).toHaveTextContent("Signing the edit…"), { timeout: 1000 });
    expect(signer.signStaged).not.toHaveBeenCalled();
    // The ways out refuse while it is held.
    fireEvent.click(within(screen.getByTestId("postEdit.header")).getByLabelText(EDIT_LEAVE_LABEL));
    expect(screen.getByTestId("post-edit-discard-confirm")).not.toHaveAttribute("open");
    await bytes.answer("land");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
    expect(sent!.attachments.map((entry) => entry.mediaId)).toEqual(["m-1", "m-2", "up-0"]);
  });

  // EditCompose.md: "an upload fails GIVEN Sign the edit was pressed while the
  // uploads ran -> the held press drops AND the gate line takes its fault
  // reading AND Sign the edit reads Sign the edit again AND the header back
  // arrow and the header X answer again AND NEVER anything is signed" …
  // "Sign the edit is disabled GIVEN the gate line shows its fault reading".
  it("drops the held press on a failed upload, the gate in its fault reading and Sign disabled", async () => {
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    const bytes = uploads();
    const signer = draw();
    await cropOneMore();
    fireEvent.click(screen.getByTestId("composeCrop.next"));
    await screen.findByTestId("postEdit.gate");
    fireEvent.click(sign());
    await bytes.answer("fail");
    await waitFor(() =>
      expect(gate()).toHaveTextContent("One picture didn't upload. Signing waits for it."),
    );
    expect(sign()).toHaveTextContent("Sign the edit");
    expect(sign()).toBeDisabled();
    expect(signer.signStaged).not.toHaveBeenCalled();
    // The tile is marked and the row's own line carries Retry and Remove it.
    expect(screen.getByTestId("postEdit.body.uploadError")).toHaveTextContent("One picture didn't upload.");
    // The ways out answer again.
    fireEvent.click(within(screen.getByTestId("postEdit.header")).getByLabelText(EDIT_LEAVE_LABEL));
    await waitFor(() => expect(screen.getByTestId("post-edit-discard-confirm")).toHaveAttribute("open"));
  });

  // EditCompose.md: "press Retry GIVEN the held press dropped -> the gate runs
  // again AND NEVER signing proceeds until Sign the edit is pressed again".
  it("Retry re-gates the upload and nothing signs until Sign is pressed again", async () => {
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    server.use(gqlLink.mutation("PreparePostEdit", () => HttpResponse.json({ data: editPrepared() })));
    const bytes = uploads();
    const signer = draw();
    await cropOneMore();
    fireEvent.click(screen.getByTestId("composeCrop.next"));
    fireEvent.click(sign());
    await bytes.answer("fail");
    fireEvent.click(await screen.findByTestId("postEdit.gate.retry"));
    expect(await screen.findByTestId("postEdit.gate")).toHaveTextContent("Uploading 0 of 1");
    await bytes.answer("land");
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    expect(signer.signStaged).not.toHaveBeenCalled();
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
  });

  // EditCompose.md: "press Remove it under the picked row GIVEN nothing else
  // the edit took is uploading -> the failed picture leaves the batch AND the
  // gate line goes AND Sign the edit is enabled".
  it("Remove it under the row takes the failed picture out and un-gates Sign", async () => {
    serve(editablePost({ attachments: [attachment("m-1"), attachment("m-2")] }));
    const bytes = uploads();
    draw();
    await cropOneMore();
    fireEvent.click(screen.getByTestId("composeCrop.next"));
    await bytes.answer("fail");
    fireEvent.click(await screen.findByTestId("postEdit.body.uploadError.remove"));
    expect(await screen.findByLabelText("Manage the 2 pictures")).toBeInTheDocument();
    expect(gate()).not.toBeInTheDocument();
    expect(sign()).not.toBeDisabled();
  });
});

describe("PostEditRoute — a clip's cover (EditComposeVideo)", () => {
  beforeEach(() => {
    push.mockClear();
    installEncoder();
  });

  it("draws the clip, its one description and the quiet line where an add control would stand", async () => {
    serve(editablePost({ attachments: [clipAttachment()] }));
    draw();
    expect(await screen.findByTestId("postEdit.video.thumb")).toBeInTheDocument();
    expect(screen.getByTestId("postEdit.video.rule")).toHaveTextContent("A video is the whole post.");
    expect(screen.queryByTestId("postEdit.body.add")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("postEdit.video.describeRow.describe"));
    expect(await screen.findByTestId("post-edit-describe")).toBeInTheDocument();
  });

  it("shows the chosen face and Change the cover where a cover was chosen", async () => {
    serve(editablePost({ attachments: [clipAttachment({ coverTaken: false })] }));
    draw();
    expect(await screen.findByTestId("postEdit.cover.change")).toHaveTextContent("Change the cover");
    expect(screen.getByTestId("postEdit.cover.thumb")).toBeInTheDocument();
    expect(screen.queryByTestId("postEdit.cover.add")).not.toBeInTheDocument();
  });

  // EditComposeVideo.md: "the cover field reads Add a cover GIVEN no cover was
  // ever chosen, even when a taken still exists".
  it("offers the door over a taken still", async () => {
    serve(editablePost({ attachments: [clipAttachment({ coverTaken: true })] }));
    draw();
    expect(await screen.findByTestId("postEdit.cover.add")).toHaveTextContent("Add a cover");
    expect(screen.queryByTestId("postEdit.cover.thumb")).not.toBeInTheDocument();
  });

  it("offers the door over a clip with no face at all", async () => {
    serve(editablePost({ attachments: [clipAttachment({ cover: false })] }));
    draw();
    expect(await screen.findByTestId("postEdit.cover.add")).toBeInTheDocument();
  });

  it("opens the device's own picker for the face, never the clip's frames", async () => {
    serve(editablePost({ attachments: [clipAttachment({ coverTaken: true })] }));
    draw();
    const input = (await screen.findByTestId("post-edit-cover-input")) as HTMLInputElement;
    const opened = vi.spyOn(input, "click");
    fireEvent.click(screen.getByTestId("postEdit.cover.add"));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(input.accept).toBe("image/*");
    expect(screen.queryByTestId("wizard-cover-frame-0")).not.toBeInTheDocument();
  });

  // EditComposeVideo.md: "a picture is picked for the cover -> it passes the
  // crop locked to the clip's shape AND the new cover joins the edit's batch".
  it("crops the face at the clip's locked shape and joins it to the batch behind the cover gate", async () => {
    serve(editablePost({ attachments: [clipAttachment({ coverTaken: true })] }));
    uploads();
    draw();
    await pickInto("post-edit-cover-input", [picture("face.jpg")]);
    const crop = await screen.findByTestId("post-edit-cover-crop");
    expect(within(crop).getByText("The cover takes the video's shape.")).toBeInTheDocument();
    expect(within(crop).queryByRole("group", { name: "The post's shape" })).not.toBeInTheDocument();
    expect(within(crop).getByRole("heading", { name: "The cover" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("coverCrop.next"));
    expect(await screen.findByTestId("postEdit.gate")).toHaveTextContent(
      "Uploading 0 of 1 — signing waits for the cover.",
    );
    expect(footer()).toHaveTextContent("You're signing 1 thing");
    // The field now holds the face and its other half, Change the cover.
    expect(screen.getByTestId("postEdit.cover.change")).toBeInTheDocument();
  });

  // EditComposeVideo.md: "press Sign the edit GIVEN the signing is taken -> the
  // post opens with the edit settling AND the clip points at the cover the
  // edit set".
  it("signs the clip pointing at the face it set, the clip itself unchanged", async () => {
    let sent: { attachments: Record<string, unknown>[] } | null = null;
    serve(editablePost({ attachments: [clipAttachment()] }));
    server.use(
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as never;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const bytes = uploads();
    draw();
    fireEvent.click(await screen.findByTestId("postEdit.cover.change"));
    await pickInto("post-edit-cover-input", [picture("face.jpg")]);
    fireEvent.click(await screen.findByTestId("coverCrop.next"));
    fireEvent.click(sign());
    await bytes.answer("land");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(sent!.attachments).toEqual([
      expect.objectContaining({ mediaId: "clip-1", coverMediaId: "up-0", coverTaken: null }),
    ]);
  });

  // EditComposeVideo.md: "the cover the edit set fails to upload -> the
  // cover's thumbnail is marked AND the line One picture didn't upload. stands
  // under the cover row with Retry and Remove it" … "press Remove it under the
  // cover row -> the new cover leaves the batch AND the cover field reads as it
  // stood before the edit".
  it("marks a failed face under the cover row, and Remove it puts the field back as it stood", async () => {
    serve(editablePost({ attachments: [clipAttachment({ coverTaken: true })] }));
    const bytes = uploads();
    draw();
    await pickInto("post-edit-cover-input", [picture("face.jpg")]);
    fireEvent.click(await screen.findByTestId("coverCrop.next"));
    await bytes.answer("fail");
    expect(await screen.findByTestId("post-edit-cover-error")).toHaveTextContent(
      "One picture didn't upload.",
    );
    expect(gate()).toHaveTextContent("One picture didn't upload. Signing waits for it.");
    expect(sign()).toBeDisabled();
    fireEvent.click(screen.getByTestId("post-edit-cover-error-remove"));
    expect(await screen.findByTestId("postEdit.cover.add")).toBeInTheDocument();
    expect(gate()).not.toBeInTheDocument();
    expect(sign()).not.toBeDisabled();
  });

  it("the cover crop's back arrow gives the cover row back, the picture unused", async () => {
    serve(editablePost({ attachments: [clipAttachment({ coverTaken: true })] }));
    const bytes = uploads();
    draw();
    await pickInto("post-edit-cover-input", [picture("face.jpg")]);
    await screen.findByTestId("post-edit-cover-crop");
    fireEvent.click(screen.getByLabelText("Back to the edit"));
    expect(await screen.findByTestId("postEdit.cover.add")).toBeInTheDocument();
    expect(footer()).toHaveTextContent("Nothing to sign yet");
    expect(bytes.calls()).toBe(0);
  });

  // EditComposeVideo.md: "tap the clip's remove control -> the clip leaves
  // whole AND the words edit stands with its field empty".
  it("the clip's remove control leaves it whole, onto the words edit with its field empty", async () => {
    serve(editablePost({ attachments: [clipAttachment()] }));
    draw();
    fireEvent.click(await screen.findByLabelText("Remove this video"));
    expect(await screen.findByTestId("postEdit.body.words.input")).toHaveValue("");
    expect(screen.queryByTestId("postEdit.video.thumb")).not.toBeInTheDocument();
  });
});

// EditWords.md: "press + Add pictures or a video -> the device's own picker
// opens" … "pictures are picked -> they pass the crop AND the words they
// replace are gone from the body".
describe("PostEditRoute — + Add pictures or a video (EditWords)", () => {
  beforeEach(() => {
    push.mockClear();
    installEncoder();
  });

  it("takes pictures through the crop, its chips offered, and the words they replace go", async () => {
    let sent: Record<string, unknown> | null = null;
    serve(editablePost());
    server.use(
      gqlLink.mutation("PreparePostEdit", ({ variables }) => {
        sent = variables.input as never;
        return HttpResponse.json({ data: editPrepared() });
      }),
    );
    const bytes = uploads();
    draw();
    const add = await screen.findByTestId("postEdit.body.add");
    expect(add).toHaveTextContent("+ Add pictures or a video");
    await pickInto("post-edit-add-media-input", [picture("a.jpg")]);
    // A words post has no shape yet, so the chips choose one.
    fireEvent.click(await screen.findByTestId("composeCrop.shapes.wideChip"));
    fireEvent.click(screen.getByTestId("composeCrop.next"));
    expect(await screen.findByLabelText("Manage the picture")).toBeInTheDocument();
    expect(screen.queryByTestId("postEdit.body.words.input")).not.toBeInTheDocument();
    await bytes.answer("land");
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    fireEvent.click(sign());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(sent).toMatchObject({ content: "", attachments: [expect.objectContaining({ mediaId: "up-0" })] });
  });
});

// EditCompose.md: "WHEN the stage opens -> focus lands on the stage's heading
// AND NEVER the keyboard rises before a field is tapped".
describe("PostEditRoute — opening", () => {
  it("lands focus on the heading, never on a field", async () => {
    serve(editablePost());
    draw();
    const heading = await screen.findByRole("heading", { name: "Edit post" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });
});
