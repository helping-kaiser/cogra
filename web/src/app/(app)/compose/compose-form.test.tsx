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
    fireEvent.click(screen.getByTestId("license-attribution"));
    fireEvent.click(screen.getByTestId("license-oversight-conditional"));
    fireEvent.click(screen.getByTestId("compose-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
    expect(variables).toEqual({
      input: {
        title: "A title",
        description: null,
        content: "The body",
        license: { attributionRequired: true, oversight: "CONDITIONAL" },
      },
    });
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
              moderationStatus: "NORMAL",
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
