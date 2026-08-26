// The follow toggle (D9, D10): plain, no pad, no axis labels — but the
// same data seam and the same severance confirmation every other
// stance-able node uses.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { hashtagStanceHandlers } from "@/test/stance";
import { TopicFollowControl } from "./topic-follow-control";

const server = startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

describe("TopicFollowControl", () => {
  // The token store persists to localStorage (web.md "Session tokens in
  // the browser"); without a clear, a prior test's signedInStore() leaks
  // into the next one, exactly the way feed-view.test.tsx and
  // post-view.test.tsx guard against.
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows Follow for a topic the viewer has never stanced", async () => {
    server.use(...hashtagStanceHandlers());
    renderWithProviders(<TopicFollowControl name="rust" testIdPrefix="topic-follow" />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await waitFor(() =>
      expect(screen.getByTestId("topic-follow")).toHaveAttribute("aria-pressed", "false"),
    );
    expect(screen.getByTestId("topic-follow")).toHaveTextContent("Follow");
  });

  it("shows Following for a topic the viewer already follows", async () => {
    server.use(
      ...hashtagStanceHandlers({ rust: { pDirected: 0.1, pInterest: 0.1, recordCount: 1 } }),
    );
    renderWithProviders(<TopicFollowControl name="rust" testIdPrefix="topic-follow" />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await waitFor(() =>
      expect(screen.getByTestId("topic-follow")).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByTestId("topic-follow")).toHaveTextContent("Following");
  });

  it("follows by committing the tap default via prepareStance with topicName", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      // One handler covering both the resting read (no pick) and the
      // follow tap's projection (with a pick) — registering two
      // separate handlers for the same operation leaves their
      // precedence order to MSW internals, which this test does not
      // want to depend on.
      graphql.query("HashtagStance", ({ variables: v }) => {
        if (v.pick != null) {
          return HttpResponse.json({
            data: {
              hashtag: {
                __typename: "Hashtag",
                id: "ht-rust",
                viewerStance: {
                  __typename: "StanceBundle",
                  pDirected: 0,
                  pInterest: 0,
                  rawPDirected: 0,
                  rawPInterest: 0,
                  recordCount: 0,
                  inert: true,
                  severed: false,
                  severanceCost: 0,
                  projected: { pDirected: 0.1, pInterest: 0.1, inert: false, severed: false },
                },
              },
            },
          });
        }
        return HttpResponse.json({
          data: {
            hashtag: {
              __typename: "Hashtag",
              id: "ht-rust",
              viewerStance: {
                __typename: "StanceBundle",
                pDirected: 0,
                pInterest: 0,
                rawPDirected: 0,
                rawPInterest: 0,
                recordCount: 0,
                inert: true,
                severed: false,
                severanceCost: 0,
                projected: null,
              },
            },
          },
        });
      }),
      graphql.mutation("PrepareStance", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareStance: {
              __typename: "PreparePayload",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "AFFINITY",
                  canonicalProposal: "cHJvcG9zYWw=",
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<TopicFollowControl name="rust" testIdPrefix="topic-follow" />, {
      store: signedInStore(),
      writeSigner: signer,
    });
    await waitFor(() =>
      expect(screen.getByTestId("topic-follow")).toHaveAttribute("aria-pressed", "false"),
    );
    fireEvent.click(screen.getByTestId("topic-follow"));
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(1));
    expect(variables).toEqual({
      input: { topicName: "rust", pDirected: 0.1, pInterest: 0.1 },
    });
  });

  it("unfollows through the severance confirm dialog, reusing prepareSeverance with topicName", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      ...hashtagStanceHandlers({ rust: { pDirected: 0.1, pInterest: 0.1, recordCount: 1 } }),
      graphql.mutation("PrepareSeverance", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareSeverance: {
              __typename: "PreparePayload",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w2",
                  family: "AFFINITY",
                  canonicalProposal: "cHJvcG9zYWw=",
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<TopicFollowControl name="rust" testIdPrefix="topic-follow" />, {
      store: signedInStore(),
      writeSigner: signer,
    });
    await waitFor(() =>
      expect(screen.getByTestId("topic-follow")).toHaveAttribute("aria-pressed", "true"),
    );
    fireEvent.click(screen.getByTestId("topic-follow"));
    expect(await screen.findByTestId("severance-confirm")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("severance-proceed"));
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(1));
    expect(variables).toEqual({ input: { topicName: "rust" } });
  });

  it("asks a guest to join instead of following", async () => {
    server.use(...hashtagStanceHandlers());
    renderWithProviders(<TopicFollowControl name="rust" testIdPrefix="topic-follow" />, {
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId("topic-follow"));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
  });
});
