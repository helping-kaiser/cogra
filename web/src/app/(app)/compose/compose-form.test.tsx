import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { writeConfirmMultiAction } from "@/lib/signing/confirm-multi-action";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { ComposeForm } from "./compose-form";

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

function preparedPayload(field: string, node: string) {
  return {
    [field]: {
      __typename: "PrepareContentPayload",
      node,
      writes: [
        {
          __typename: "PreparedWrite",
          id: "w1",
          family: "PUBLISH",
          canonicalProposal: "cHJvcG9zYWw=",
          gcAfterEpochs: 8,
        },
      ],
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

/**
 * A `ReferenceClaim` as the wire serves it: the L1 identifier beside the
 * TYPED target, whose own `id` is the L2 one the prepare verbs take.
 */
function referenceClaim(
  id: string,
  handle: string,
  relevance = 0.1,
  support = 0.1,
  withdrawalCost = 1,
) {
  return {
    __typename: "ReferenceClaim",
    targetId: `l1-${id}`,
    relevance,
    support,
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

/** The edit screen's own read, with whatever claims the post carries. */
function editablePost(
  topics: ReturnType<typeof topicClaim>[] = [],
  references: ReturnType<typeof referenceClaim>[] = [],
) {
  return {
    post: {
      __typename: "Post",
      id: "p1",
      title: { __typename: "ModeratedText", value: "Old title", status: "NORMAL" },
      description: { __typename: "ModeratedText", value: null, status: "NORMAL" },
      content: { __typename: "ModeratedText", value: "Old body", status: "NORMAL" },
      author: { __typename: "User", id: "u1", handle: "alice" },
      createdAt: "2026-08-12T10:00:00Z",
      updatedAt: "2026-08-12T10:00:00Z",
      landing: { __typename: "Landing", state: "LANDED" },
      moderationStatus: "NORMAL",
      license: { __typename: "License", attribution: 0, provenance: 0 },
      topics,
      references,
      comments: {
        __typename: "CommentConnection",
        edges: [],
        pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
      },
    },
  };
}

function tagPayload(id: string) {
  return {
    prepareTag: {
      __typename: "PreparePayload",
      writes: [
        {
          __typename: "PreparedWrite",
          id,
          family: "TAG",
          canonicalProposal: "cHJvcG9zYWw=",
        },
      ],
      userErrors: [],
    },
  };
}

describe("ComposeForm", () => {
  beforeEach(() => {
    push.mockClear();
    searchParams = new URLSearchParams();
    // The multi-action confirmation has its own tests below; everywhere
    // else it would only stand between the test and the submit.
    writeConfirmMultiAction(false);
  });

  it("backs to the feed when composing fresh", () => {
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(screen.getByTestId("compose-back")).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("link", { name: "Back to feed" })).toBeInTheDocument();
  });

  it("backs to the post when editing", async () => {
    searchParams = new URLSearchParams("post=p1");
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: { post: null } })),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(screen.getByRole("link", { name: "Back to post" })).toHaveAttribute(
      "href",
      "/posts/p1",
    );
    // A post that no longer resolves backs to the feed instead.
    expect(await screen.findByTestId("compose-not-found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to feed" })).toHaveAttribute("href", "/feed");
  });

  it("signs a new post and returns to the feed", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      graphql.mutation("PreparePost", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({ data: preparedPayload("preparePost", "node-1") });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<ComposeForm />, { store: signedInStore(), writeSigner: signer });

    fireEvent.change(screen.getByTestId("compose-title"), { target: { value: "A title" } });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "The body" } });
    fireEvent.click(screen.getByTestId("compose-license-attribution-1"));
    fireEvent.click(screen.getByTestId("compose-license-provenance-0.5"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
    expect(variables).toEqual({
      input: {
        title: "A title",
        description: null,
        content: "The body",
        license: { attribution: 1, provenance: 0.5 },
        tags: [],
        references: [],
        // The 1.0 form authors words only; the gallery is the wizard's.
        attachments: null,
      },
    });
  });

  it("stages the drafted tags with the parameters their sliders hold", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      graphql.mutation("PreparePost", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({ data: preparedPayload("preparePost", "node-1") });
      }),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });

    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "The body" } });
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "#Rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    // The second tag goes in with moved sliders (F6).
    fireEvent.change(screen.getByTestId("compose-tag-new-relevance"), {
      target: { value: "0.75" },
    });
    fireEvent.change(screen.getByTestId("compose-tag-new-confidence"), {
      target: { value: "0.5" },
    });
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "webdev" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-license-attribution-1"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    expect(variables).toMatchObject({
      input: {
        tags: [
          { name: "rust", pDirected: 0.1, pInterest: 1 },
          { name: "webdev", pDirected: 0.75, pInterest: 0.5 },
        ],
      },
    });
  });

  it("surfaces a batched tag refusal on its own chip", async () => {
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: null,
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "not a legal topic name",
                  code: "BAD_INPUT",
                  field: ["tags", "1", "name"],
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "a-b" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    expect(await screen.findByTestId("compose-tag-error-1")).toHaveTextContent(
      "not a legal topic name",
    );
    // A field error is not the general refusal line.
    expect(screen.queryByTestId("compose-refused")).not.toBeInTheDocument();
  });

  it("blocks an 11th topic client-side", async () => {
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    for (let i = 0; i < 10; i += 1) {
      fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: `t${i}` } });
      fireEvent.click(screen.getByTestId("compose-tag-add"));
    }
    expect(screen.getAllByTestId(/^compose-tag-\d+$/)).toHaveLength(10);
    expect(screen.getByTestId("compose-tag-cap")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "eleventh" } });
    expect(screen.getByTestId("compose-tag-add")).toBeDisabled();
  });

  it("refuses an empty body locally", async () => {
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(screen.getByTestId("compose-submit"));
    expect(await screen.findByTestId("compose-empty-body")).toBeInTheDocument();
  });

  it("renders the server refusal", async () => {
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: null,
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "the write rule refused",
                  code: "WRITE_RULE_FAILED",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.click(screen.getByTestId("compose-submit"));
    expect(await screen.findByTestId("compose-refused")).toHaveTextContent(
      "the write rule refused",
    );
  });

  it("edit mode pre-fills, hides the license, and clears with nulls", async () => {
    searchParams = new URLSearchParams("post=p1");
    let editVariables: Record<string, unknown> | null = null;
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: {
            post: {
              __typename: "Post",
              id: "p1",
              title: { __typename: "ModeratedText", value: "Old title", status: "NORMAL" },
              description: { __typename: "ModeratedText", value: null, status: "NORMAL" },
              content: { __typename: "ModeratedText", value: "Old body", status: "NORMAL" },
              author: { __typename: "User", id: "u1", handle: "alice" },
              createdAt: "2026-08-12T10:00:00Z",
              updatedAt: "2026-08-12T10:00:00Z",
              landing: { __typename: "Landing", state: "LANDED" },
              moderationStatus: "NORMAL",
              license: { __typename: "License", attribution: 0, provenance: 0 },
              topics: [],
              references: [],
              comments: {
                __typename: "CommentConnection",
                edges: [],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
      graphql.mutation("PreparePostEdit", ({ variables }) => {
        editVariables = variables;
        return HttpResponse.json({ data: preparedPayload("preparePostEdit", "p1") });
      }),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });

    expect(await screen.findByTestId("compose-title")).toHaveValue("Old title");
    expect(screen.queryByTestId("compose-license")).not.toBeInTheDocument();

    // Blank the title (the clear) and change the body.
    fireEvent.change(screen.getByTestId("compose-title"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "New body" } });
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(editVariables).toEqual({
      input: { id: "p1", title: null, description: null, content: "New body" },
    });
  });

  // F3: tag editing lives on the edit screen now. Tags are still never
  // fields of the edit record — each change is its own Tag act.
  it("loads the post's current tags as adjustable, removable chips", async () => {
    searchParams = new URLSearchParams("post=p1");
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: editablePost([topicClaim("rust", 0.4, 0.8)]) }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("compose-tag-0")).toHaveTextContent("#rust");
    expect(screen.getByTestId("compose-tag-0-remove")).toBeInTheDocument();
    // The chip opens on the values the claim actually carries.
    fireEvent.click(screen.getByTestId("compose-tag-0-select"));
    expect(screen.getByTestId("compose-tag-0-relevance")).toHaveValue("0.4");
    expect(screen.getByTestId("compose-tag-0-confidence")).toHaveValue("0.8");
    // No creation batch here, so no batch cap.
    expect(screen.queryByTestId("compose-tag-cap")).not.toBeInTheDocument();
  });

  it("stages the edit record and one Tag act per change, in one signing pass", async () => {
    searchParams = new URLSearchParams("post=p1");
    const tagInputs: Record<string, unknown>[] = [];
    let editCalled = false;
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: editablePost([topicClaim("wasm")]) }),
      ),
      graphql.mutation("PreparePostEdit", () => {
        editCalled = true;
        return HttpResponse.json({ data: preparedPayload("preparePostEdit", "p1") });
      }),
      graphql.mutation("PrepareTag", ({ variables }) => {
        tagInputs.push(variables.input as Record<string, unknown>);
        return HttpResponse.json({ data: tagPayload(`w-tag-${tagInputs.length}`) });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<ComposeForm />, { store: signedInStore(), writeSigner: signer });

    await screen.findByTestId("compose-tag-0");
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "New body" } });
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    // Drop the tag the post came with.
    fireEvent.click(screen.getByTestId("compose-tag-0-remove"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(editCalled).toBe(true);
    expect(tagInputs).toEqual([
      { target: "p1", name: "rust", pDirected: 0.1, pInterest: 1 },
      // A withdrawal is a Tag act at relevance 0, never a deletion.
      { target: "p1", name: "wasm", pDirected: 0, pInterest: null },
    ]);
    // The edit record plus both Tag acts, all signed in the one pass.
    expect(signer.signStaged).toHaveBeenCalledTimes(3);
  });

  it("stages no edit record when only the tags moved", async () => {
    searchParams = new URLSearchParams("post=p1");
    let editCalled = false;
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: editablePost() })),
      graphql.mutation("PreparePostEdit", () => {
        editCalled = true;
        return HttpResponse.json({ data: preparedPayload("preparePostEdit", "p1") });
      }),
      graphql.mutation("PrepareTag", () => HttpResponse.json({ data: tagPayload("w-tag-1") })),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<ComposeForm />, { store: signedInStore(), writeSigner: signer });

    await screen.findByTestId("compose-tag-input");
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/p1"));
    expect(editCalled).toBe(false);
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
  });

  // F2: a prepare refusal is a field error. Nothing was staged, so the
  // signing line would be a lie — and nothing is signed either.
  it("routes a refused Tag act onto its chip, signing nothing", async () => {
    searchParams = new URLSearchParams("post=p1");
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: editablePost() })),
      graphql.mutation("PreparePostEdit", () =>
        HttpResponse.json({ data: preparedPayload("preparePostEdit", "p1") }),
      ),
      graphql.mutation("PrepareTag", () =>
        HttpResponse.json({
          data: {
            prepareTag: {
              __typename: "PreparePayload",
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "`a-b` is not a legal topic name: reserved",
                  code: "BAD_INPUT",
                  field: ["name"],
                },
              ],
            },
          },
        }),
      ),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<ComposeForm />, { store: signedInStore(), writeSigner: signer });

    await screen.findByTestId("compose-tag-input");
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "a-b" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    expect(await screen.findByTestId("compose-tag-error-0")).toHaveTextContent(
      "`a-b` is not a legal topic name: reserved",
    );
    expect(screen.queryByTestId("compose-refused")).not.toBeInTheDocument();
    expect(screen.queryByTestId("compose-signing-failed")).not.toBeInTheDocument();
    expect(signer.signStaged).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  // F4: the cost is on screen before the press, and a batch is asked
  // about rather than signed on the reader's behalf.
  it("counts the signed actions a creation would stage, live", () => {
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
      "creates 1 signed action",
    );
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "wasm" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
      "creates 3 signed actions",
    );
    fireEvent.click(screen.getByTestId("compose-tag-1-remove"));
    expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
      "creates 2 signed actions",
    );
  });

  it("counts an edit as the record only when the content moved", async () => {
    searchParams = new URLSearchParams("post=p1");
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: editablePost([topicClaim("wasm")]) }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    // Untouched: nothing to sign, and nothing to press.
    expect(await screen.findByTestId("compose-signed-actions")).toHaveTextContent(
      "creates no signed actions",
    );
    expect(screen.getByTestId("compose-submit")).toBeDisabled();

    fireEvent.click(screen.getByTestId("compose-tag-0-remove"));
    expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
      "creates 1 signed action",
    );
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "New body" } });
    expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
      "creates 2 signed actions",
    );
  });

  it("asks before a submit that signs more than one action", async () => {
    writeConfirmMultiAction(true);
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({ data: preparedPayload("preparePost", "node-1") }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    expect(screen.getByTestId("compose-multi-action-count")).toHaveTextContent(
      "creates 2 signed actions",
    );
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("compose-multi-action-proceed"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
  });

  it("does not ask for a single signed action", () => {
    writeConfirmMultiAction(true);
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({ data: preparedPayload("preparePost", "node-1") }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.click(screen.getByTestId("compose-submit"));
    expect(screen.queryByTestId("compose-multi-action-confirm")).not.toBeInTheDocument();
  });

  it("cancelling the confirmation signs nothing", () => {
    writeConfirmMultiAction(true);
    const signer = fakeWriteSigner();
    renderWithProviders(<ComposeForm />, { store: signedInStore(), writeSigner: signer });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-submit"));
    fireEvent.click(screen.getByTestId("compose-multi-action-cancel"));
    expect(screen.queryByTestId("compose-multi-action-confirm")).not.toBeInTheDocument();
    expect(signer.signStaged).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("remembers a don't-show-again, and stops asking", async () => {
    writeConfirmMultiAction(true);
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({ data: preparedPayload("preparePost", "node-1") }),
      ),
    );
    const { unmount } = renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-submit"));
    fireEvent.click(screen.getByTestId("compose-multi-action-remember"));
    fireEvent.click(screen.getByTestId("compose-multi-action-proceed"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    unmount();

    push.mockClear();
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-submit"));
    expect(screen.queryByTestId("compose-multi-action-confirm")).not.toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
  });

  it("reports an unfinished signing without navigating", async () => {
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({ data: preparedPayload("preparePost", "node-1") }),
      ),
    );
    renderWithProviders(
      <ComposeForm store={fakeIdentityStore({ keyOnDevice: true })} />,
      {
        store: signedInStore(),
        writeSigner: fakeWriteSigner({
          signStaged: vi.fn(() =>
            Promise.resolve({ kind: "failed" as const, id: "w1", cause: new Error("offline") }),
          ),
        }),
      },
    );
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.click(screen.getByTestId("compose-submit"));
    expect(await screen.findByTestId("compose-signing-failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("collapses the restore card into the header for a keyless browser", async () => {
    // A keyless writer learns before drafting, not at submit
    // (design.md §6).
    renderWithProviders(<ComposeForm store={fakeIdentityStore({})} />, {
      store: signedInStore(),
    });
    const restore = await screen.findByTestId("home_restore");
    expect(screen.getByTestId("collapsing-top")).toContainElement(restore);
  });

  it("shows no restore card while the key is on this browser", async () => {
    renderWithProviders(<ComposeForm store={fakeIdentityStore({ keyOnDevice: true })} />, {
      store: signedInStore(),
    });
    expect(await screen.findByTestId("compose-body")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("home_restore")).not.toBeInTheDocument(),
    );
  });

  it("tells a keyless browser to restore, not to wait", async () => {
    // The write genuinely waits on the reader acting — the copy must
    // say so instead of the generic stays-pending line.
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({ data: preparedPayload("preparePost", "node-1") }),
      ),
    );
    renderWithProviders(<ComposeForm store={fakeIdentityStore({})} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner({
        signStaged: vi.fn(() =>
          Promise.resolve({ kind: "awaitingSeal" as const, id: "w1" }),
        ),
      }),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    fireEvent.click(screen.getByTestId("compose-submit"));
    const alert = await screen.findByTestId("compose-signing-needs-key");
    expect(alert).toHaveTextContent("Restore your key");
    expect(screen.queryByTestId("compose-signing-failed")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

// Slice 2.4. Named apart from the tag suite above: the two sections are
// siblings on this screen, and a failure should say which one broke.
describe("ComposeForm — references", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    window.localStorage.clear();
    // Asking is the default; the tests that care turn it back on.
    writeConfirmMultiAction(false);
  });

  function candidatesRespond(id: string, handle: string) {
    return graphql.query("ReferenceCandidates", () =>
      HttpResponse.json({
        data: {
          referenceCandidates: [
            {
              __typename: "ReferenceCandidate",
              targetId: id,
              target: {
                __typename: "User",
                id,
                handle,
                displayName: { __typename: "ModeratedText", value: handle },
              },
            },
          ],
        },
      }),
    );
  }

  function referenceWrites(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      __typename: "PreparedWrite",
      id: `r${i}`,
      family: "REFERENCE",
      canonicalProposal: "cHJvcG9zYWw=",
      gcAfterEpochs: 8,
    }));
  }

  async function draftOneReference(id = "u-ada", handle = "ada") {
    server.use(candidatesRespond(id, handle));
    fireEvent.click(screen.getByTestId("compose-reference-add"));
    fireEvent.change(screen.getByTestId("compose-finder-query"), {
      target: { value: handle },
    });
    fireEvent.click(await screen.findByTestId(`compose-finder-candidate-${id}`));
  }

  it("counts a drafted reference beside the mint and the tags", async () => {
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
      "creates 1 signed action",
    );
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "rust" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    await draftOneReference();
    // 1 mint + 1 tag + 1 reference.
    await waitFor(() =>
      expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
        "creates 3 signed actions",
      ),
    );
    fireEvent.click(screen.getByTestId("compose-reference-0-remove"));
    expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
      "creates 2 signed actions",
    );
  });

  it("sends the drafted references on the minting batch, at their own values", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation("PreparePost", ({ variables }) => {
        sent = variables;
        return HttpResponse.json({ data: preparedPayload("preparePost", "node-1") });
      }),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    await draftOneReference();
    fireEvent.click(await screen.findByTestId("compose-reference-0-select"));
    fireEvent.change(screen.getByTestId("compose-reference-0-support"), {
      target: { value: "-0.5" },
    });
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(sent).toBeDefined());
    const input = (sent as { input: { references: unknown[] } }).input;
    expect(input.references).toEqual([
      { target: "u-ada", relevance: 0.1, support: -0.5 },
    ]);
  });

  it("routes a batched reference's refusal onto that exact chip", async () => {
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: null,
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "A post cannot reference itself.",
                  code: "INVALID_ARGUMENT",
                  field: ["references", "0", "target"],
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    await draftOneReference();
    fireEvent.click(screen.getByTestId("compose-submit"));

    expect(await screen.findByTestId("compose-reference-error-0")).toHaveTextContent(
      "A post cannot reference itself.",
    );
    expect(screen.queryByTestId("compose-refused")).not.toBeInTheDocument();
  });

  it("surfaces a whole-batch refusal as one clear line, not on a chip", async () => {
    // D19: the balance is checked against the whole bundle, and a batch
    // it cannot carry is refused before any act is staged.
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: null,
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "Your balance can't carry all 3 actions.",
                  code: "INSUFFICIENT_BALANCE",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(screen.getByTestId("compose-body"), { target: { value: "b" } });
    await draftOneReference();
    fireEvent.click(screen.getByTestId("compose-submit"));

    expect(await screen.findByTestId("compose-refused")).toHaveTextContent(
      "Your balance can't carry all 3 actions.",
    );
    expect(screen.queryByTestId("compose-reference-error-0")).not.toBeInTheDocument();
  });

  it("prefills the chip the Reference affordance sent it", async () => {
    searchParams = new URLSearchParams("reference=p-quoted");
    server.use(
      graphql.query("ReferenceCandidates", () =>
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
                },
              },
            ],
          },
        }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("compose-reference-0")).toHaveTextContent(
      "@carol: On folding",
    );
    // The mint plus the prefilled reference.
    expect(screen.getByTestId("compose-signed-actions")).toHaveTextContent(
      "creates 2 signed actions",
    );
  });

  it("stages nothing for an untouched reference section on an edit", async () => {
    searchParams = new URLSearchParams("post=p1");
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: editablePost([], [referenceClaim("u-ada", "ada")]) }),
      ),
    );
    renderWithProviders(<ComposeForm />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("compose-signed-actions")).toHaveTextContent(
      "creates no signed actions",
    );
    expect(screen.getByTestId("compose-reference-0")).toHaveTextContent("@ada");
  });

  it("asks before it prepares, on the withdrawal cost the claim serves", async () => {
    // B4: withdrawal is per-leg net stance, so the cost is a BATCH — and
    // the claim quotes it, so the confirm comes first and nothing is
    // staged until the author has agreed to the price.
    writeConfirmMultiAction(true);
    searchParams = new URLSearchParams("post=p1");
    let withdrawalInput: Record<string, unknown> | undefined;
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: editablePost([], [referenceClaim("u-ada", "ada", 1, 1, 3)]),
        }),
      ),
      graphql.mutation("PrepareReferenceWithdrawal", ({ variables }) => {
        withdrawalInput = variables;
        return HttpResponse.json({
          data: {
            prepareReferenceWithdrawal: {
              __typename: "PreparePayload",
              writes: referenceWrites(3),
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<ComposeForm />, { store: signedInStore(), writeSigner: signer });

    fireEvent.click(await screen.findByTestId("compose-reference-0-remove"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    const count = await screen.findByTestId("compose-multi-action-count");
    expect(count).toHaveTextContent("creates 3 signed actions");
    // Nothing is staged, let alone signed, while the reader decides.
    expect(withdrawalInput).toBeUndefined();
    expect(signer.signStaged).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("compose-multi-action-proceed"));
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(3));
    // The withdrawal names the L2 id, never the claim's L1 identifier.
    expect((withdrawalInput as { input: { target: string } }).input.target).toBe("u-ada");
  });

  it("stages an added reference on an edit as its own act", async () => {
    searchParams = new URLSearchParams("post=p1");
    let referenceInput: Record<string, unknown> | undefined;
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: editablePost() })),
      graphql.mutation("PrepareReference", ({ variables }) => {
        referenceInput = variables;
        return HttpResponse.json({
          data: {
            prepareReference: {
              __typename: "PreparePayload",
              writes: referenceWrites(1),
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<ComposeForm />, { store: signedInStore(), writeSigner: signer });
    await screen.findByTestId("compose-body");
    await draftOneReference();
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(referenceInput).toBeDefined());
    expect((referenceInput as { input: Record<string, unknown> }).input).toMatchObject({
      artifact: "p1",
      target: "u-ada",
      relevance: 0.1,
      support: 0.1,
    });
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(1));
  });
});
