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

/** The edit screen's own read, with whatever tags the post carries. */
function editablePost(topics: ReturnType<typeof topicClaim>[] = []) {
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
