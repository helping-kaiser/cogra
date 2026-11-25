// @vitest-environment jsdom
//
// The account boundary empties the Apollo cache. The cache is keyed by query,
// not by viewer (web.md "a viewer-scoped read always asks the server"), so an
// answer one account earned — its `me`, its stance toward a post — must not
// outlive that account in a tab where accounts are kept side by side. Every
// way the active account ends or changes passes through the token store, so
// this file drives the store itself and reads the cache's extract.

import { ApolloClient, InMemoryCache } from "@apollo/client";
import { parse } from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeDocument } from "@/__generated__/graphql";
import { createGuardedClient } from "./browser-guard";
import { createTokenStore, type TokenStore } from "./token-store";

// A probe shaped like the viewer-scoped reads the app makes: the reader's own
// account and the reader's stance toward one post. A parsed fixture rather
// than an operation document: the app never sends it, so codegen never sees it.
const VIEWER_PROBE = parse(`
  query ViewerProbe {
    me {
      id
      handle
    }
    post(id: "post-1") {
      id
      viewerStance {
        targetGraphId
      }
    }
  }
`);

type Answer = { readonly me: unknown; readonly post: unknown };

function answerAs(account: string | null): Answer {
  return {
    me: account === null ? null : { __typename: "User", id: account, handle: `handle-${account}` },
    post: {
      __typename: "Post",
      id: "post-1",
      viewerStance: account === null ? null : { __typename: "StanceBundle", targetGraphId: `given-by-${account}` },
    },
  };
}

type Sent = { readonly operation: string; readonly authorization: string | undefined };

/** Answers every read as whoever its bearer names; a missing bearer is the guest. */
function serveAsBearer() {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { operationName: string };
      const authorization = (init.headers as Record<string, string>).authorization;
      sent.push({ operation: body.operationName, authorization });
      const account = authorization?.replace("Bearer access-", "") ?? null;
      return json({ data: answerAs(account) });
    }),
  );
  return sent;
}

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function clientOver(store: TokenStore) {
  return createGuardedClient(
    store,
    "http://localhost/graphql",
    (link) => new ApolloClient({ cache: new InMemoryCache(), link }),
  );
}

function signedInAs(account: string): TokenStore {
  const store = createTokenStore();
  store.save({ accessToken: `access-${account}`, refreshToken: `refresh-${account}`, accountId: account });
  return store;
}

/** Lets the boundary's reset and any late answer land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function cached(client: ApolloClient): string {
  return JSON.stringify(client.cache.extract());
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the account boundary empties the cache", () => {
  it("leaves no viewer-scoped answer of the old account after sign-out", async () => {
    serveAsBearer();
    const store = signedInAs("acct-a");
    const client = clientOver(store);
    await client.query({ query: VIEWER_PROBE, fetchPolicy: "network-only" });
    expect(cached(client)).toContain("given-by-acct-a");

    store.clear();
    await settle();

    const left = cached(client);
    expect(left).not.toContain("acct-a");
    expect(left).not.toContain("viewerStance");
    expect(left).not.toContain('"me"');
  });

  it("lets no read in flight at sign-out write the old account's answer back", async () => {
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    const store = signedInAs("acct-a");
    const client = clientOver(store);
    const inFlight = client.query({ query: VIEWER_PROBE, fetchPolicy: "network-only" }).catch(() => null);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    store.clear();
    await settle();
    // The server answers late, as the account the request was sent as.
    answer(json({ data: answerAs("acct-a") }));
    await inFlight;
    await settle();

    expect(cached(client)).not.toContain("acct-a");
  });

  it("empties it when a refused refresh signs the tab out", async () => {
    window.localStorage.setItem("cogra.activeAccount", "acct-a");
    window.localStorage.setItem("cogra.refreshToken", "stored-refresh");
    const store = createTokenStore();
    const client = clientOver(store);
    client.writeQuery({ query: VIEWER_PROBE, data: answerAs("acct-a") });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { operationName: string };
        return json({
          data:
            body.operationName === "RefreshSession"
              ? {
                  refreshSession: {
                    auth: null,
                    userErrors: [{ code: "REFRESH_TOKEN_INVALID", message: "revoked", field: null }],
                  },
                }
              : { me: null },
        });
      }),
    );

    await client.query({ query: MeDocument, fetchPolicy: "network-only" });
    await settle();

    expect(store.refreshToken()).toBeNull();
    expect(cached(client)).not.toContain("acct-a");
  });

  it("empties it when another tab signs out", async () => {
    serveAsBearer();
    const store = signedInAs("acct-a");
    const client = clientOver(store);
    await client.query({ query: VIEWER_PROBE, fetchPolicy: "network-only" });

    // What the other tab's sign-out looks like from here: the keys are gone
    // and this tab hears a storage event.
    window.localStorage.removeItem("cogra.refreshToken");
    window.localStorage.removeItem("cogra.activeAccount");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "cogra.activeAccount", oldValue: "acct-a", newValue: null }),
    );
    await settle();

    expect(cached(client)).not.toContain("acct-a");
  });

  it("never answers a second account from the first account's entities", async () => {
    const sent = serveAsBearer();
    const store = signedInAs("acct-a");
    const client = clientOver(store);
    await client.query({ query: VIEWER_PROBE });

    store.save({ accessToken: "access-acct-b", refreshToken: "refresh-acct-b", accountId: "acct-b" });
    await settle();
    expect(cached(client)).not.toContain("acct-a");

    // A cache-first read: with the cache emptied it has to ask, as acct-b.
    const read = await client.query({ query: VIEWER_PROBE });
    expect(sent.at(-1)).toEqual({ operation: "ViewerProbe", authorization: "Bearer access-acct-b" });
    expect(JSON.stringify(read.data)).toContain("given-by-acct-b");
    expect(JSON.stringify(read.data)).not.toContain("acct-a");
  });

  it("keeps the cache across a rotation of the same account", async () => {
    serveAsBearer();
    const store = signedInAs("acct-a");
    const client = clientOver(store);
    await client.query({ query: VIEWER_PROBE, fetchPolicy: "network-only" });

    store.save({ accessToken: "access-acct-a", refreshToken: "rotated", accountId: "acct-a" });
    await settle();

    expect(cached(client)).toContain("given-by-acct-a");
  });

  it("still answers a guest's read right after sign-out", async () => {
    const sent = serveAsBearer();
    const store = signedInAs("acct-a");
    const client = clientOver(store);
    await client.query({ query: VIEWER_PROBE, fetchPolicy: "network-only" });

    store.clear();
    await settle();
    const read = await client.query({ query: VIEWER_PROBE });

    expect(sent.at(-1)).toEqual({ operation: "ViewerProbe", authorization: undefined });
    expect(read.data).toEqual(answerAs(null));
  });
});
