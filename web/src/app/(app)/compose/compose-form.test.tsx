import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
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

describe("ComposeForm", () => {
  beforeEach(() => {
    push.mockClear();
    searchParams = new URLSearchParams();
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

  it("stages the drafted tags as names only", async () => {
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
    fireEvent.change(screen.getByTestId("compose-tag-input"), { target: { value: "webdev" } });
    fireEvent.click(screen.getByTestId("compose-tag-add"));
    fireEvent.click(screen.getByTestId("compose-license-attribution-1"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    expect(variables).toMatchObject({
      input: { tags: [{ name: "rust" }, { name: "webdev" }] },
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
